#!/usr/bin/env python3
"""Compile generated bundles and compare their robot physics with pinned Microduck.

Usage: python scripts/validate-exports.py /tmp/duckrobe-export-v2-validation
Requires numpy and mujoco (tested version is recorded in the JSON report).
Each immediate child directory must contain microduck.xml, microduck.urdf,
manifest.json, and the extracted relative mesh files. No viewer is required.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import time
import xml.etree.ElementTree as ET

try:
    import mujoco
    import numpy as np
except ImportError as error:
    raise SystemExit("Install validation dependencies with: pip install mujoco numpy") from error


REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO / "public/robot/source/robot_allcollisions.xml"
SLOTS = ("hat", "eyewear", "body", "accessory", "legwear")
SHELL_MESHES = {"top_head_shell.stl", "left_shell.stl", "right_shell.stl", "upper_leg_left.stl",
                "upper_leg_right.stl", "trunk_base.stl", "face_part.stl"}
ACCENT_MESHES = {"jaw.stl", "jaw_soft.stl", "soft_mouth_top.stl", "bottom_head_shell.stl",
                 "noenoeil.stl", "foot_left.stl", "foot_right.stl", "ankle_left.stl", "ankle_right.stl"}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def close(actual, expected, label, atol=1e-10, rtol=1e-9):
    actual, expected = np.asarray(actual), np.asarray(expected)
    require(actual.shape == expected.shape, f"{label}: shape {actual.shape} != {expected.shape}")
    if not np.allclose(actual, expected, atol=atol, rtol=rtol, equal_nan=False):
        error = np.max(np.abs(actual.astype(float) - expected.astype(float))) if actual.size else 0
        raise AssertionError(f"{label}: values differ (maximum error {error})")


def numbers(value, default=""):
    result = np.array([float(item) for item in (value if value is not None else default).split()])
    require(np.all(np.isfinite(result)), "Non-finite XML value")
    return result


def quaternion_matrix(value):
    q = numbers(value, "1 0 0 0")
    require(len(q) == 4 and np.linalg.norm(q) > 0, "Invalid quaternion")
    w, x, y, z = q / np.linalg.norm(q)
    return np.array([
        [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
        [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
        [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)],
    ])


def rpy_matrix(value):
    # URDF fixed-axis roll/pitch/yaw: Rz(yaw) @ Ry(pitch) @ Rx(roll).
    roll, pitch, yaw = numbers(value, "0 0 0")
    sr, cr, sp, cp, sy, cy = math.sin(roll), math.cos(roll), math.sin(pitch), math.cos(pitch), math.sin(yaw), math.cos(yaw)
    return np.array([
        [cy*cp, cy*sp*sr - sy*cr, cy*sp*cr + sy*sr],
        [sy*cp, sy*sp*sr + cy*cr, sy*sp*cr - cy*sr],
        [-sp, cp*sr, cp*cr],
    ])


def transform(position, rotation):
    matrix = np.eye(4)
    matrix[:3, :3] = rotation
    matrix[:3, 3] = position
    return matrix


def axis_rotation(axis, angle):
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    cross = np.array([[0, -z, y], [z, 0, -x], [-y, x, 0]])
    return np.eye(3) + math.sin(angle) * cross + (1 - math.cos(angle)) * (cross @ cross)


def local_file(base, reference):
    require(reference and not Path(reference).is_absolute() and ":" not in reference,
            f"Mesh must use a relative file path: {reference}")
    path = (base / reference).resolve()
    require(path.is_relative_to(base.resolve()), f"Path escapes the bundle: {reference}")
    require(path.is_file(), f"Missing mesh or material file: {path}")
    return path


def xml_semantics(element):
    return (element.tag, tuple(sorted(element.attrib.items())), (element.text or "").strip(),
            tuple(xml_semantics(child) for child in element))


def source_mesh_files(source_xml):
    return {mesh.get("name", Path(mesh.get("file")).stem): mesh.get("file")
            for mesh in source_xml.findall("asset/mesh")}


def palette_overrides(source_xml, manifest):
    mesh_files = source_mesh_files(source_xml)
    files = set(mesh_files.values())
    visual_files = {mesh_files[geom.get("mesh")] for geom in source_xml.findall(".//worldbody//geom")
                    if geom.get("class") == "visual"}
    overrides = {}
    for item in manifest.get("visualPaletteOverrides", []):
        require(item["meshFile"] in files and item["meshFile"] not in overrides, "Invalid or duplicate visual palette override")
        rgba = np.asarray(item["rgba"])
        require(rgba.shape == (4,) and np.all(np.isfinite(rgba)) and np.all((rgba >= 0) & (rgba <= 1)), "Invalid visual override color")
        overrides[item["meshFile"]] = rgba
    colors = manifest["bodyColors"]
    require(set(colors) == {"shell", "accent"}, "bodyColors must specify shell and accent")
    for channel, meshes in (("shell", SHELL_MESHES), ("accent", ACCENT_MESHES)):
        color = colors[channel]
        require(isinstance(color, str) and re.fullmatch(r"#[0-9a-f]{6}", color), f"Invalid normalized {channel} color")
        rgba = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)] + [1]
        for filename in meshes:
            if filename in visual_files:
                require(filename in overrides, f"Missing dynamic {channel} palette: {filename}")
                close(overrides[filename], rgba, f"{filename} dynamic {channel} palette")
        require(any(filename in overrides for filename in meshes), f"No native {channel} palette overrides")
    return overrides


def validate_selection(manifest, source_xml):
    selection = manifest["selection"]
    require(isinstance(selection, dict) and set(selection) == set(SLOTS), "Selection must contain exactly the five wardrobe slots")
    native_bodies = {body.get("name") for body in source_xml.findall(".//worldbody//body")}
    slots = {slot: {"itemId": selection[slot], "meshes": 0, "bodies": set()} for slot in SLOTS}
    for slot, item_id in selection.items():
        require(item_id is None or (isinstance(item_id, str) and item_id), f"Invalid selected item ID: {slot}")
    for index, part in enumerate(manifest["clothing"]):
        slot = part.get("slot")
        require(slot in slots, f"Unknown garment slot: {slot}")
        require(selection[slot] is not None, f"Removed slot still has geometry: {slot}")
        require(part.get("itemId") == selection[slot], f"Garment item ID disagrees with selected {slot}: {part.get('itemId')}")
        require(part.get("bodyName") in native_bodies, f"Unknown garment body anchor: {part.get('bodyName')}")
        require(part.get("name") == f"duckrobe_{slot}_{index:03d}", f"Garment name disagrees with slot/index: {part.get('name')}")
        slots[slot]["meshes"] += 1
        slots[slot]["bodies"].add(part["bodyName"])
    for slot, stats in slots.items():
        require(selection[slot] is None or stats["meshes"] > 0, f"Selected slot has no exported geometry: {slot}")
        stats["bodies"] = sorted(stats["bodies"])
    if selection["eyewear"] is not None:
        eyewear = [part for part in manifest["clothing"] if part["slot"] == "eyewear"]
        for suffix, label in ((":single-eyepiece-rim", "eyepiece rim"), (":single-optical-lens", "optical lens")):
            count = sum(isinstance(part.get("detailName"), str) and part["detailName"].endswith(suffix) for part in eyewear)
            require(count == 1, f"Microduck monocular eyewear must contain exactly one {label}; got {count}")
    return slots


def validate_obj(path, part):
    vertices, normals, uv, faces = [], [], [], []
    for line_number, line in enumerate(path.read_text().splitlines(), 1):
        fields = line.split()
        if not fields or fields[0].startswith("#"):
            continue
        if fields[0] in ("v", "vn", "vt"):
            values = numbers(" ".join(fields[1:]))
            require(len(values) == (2 if fields[0] == "vt" else 3), f"Invalid OBJ vector: {path}:{line_number}")
            {"v": vertices, "vn": normals, "vt": uv}[fields[0]].append(values)
        elif fields[0] == "mtllib":
            # OBJ material files may live above the mesh subdirectory, within the bundle.
            target = (path.parent / " ".join(fields[1:])).resolve()
            require(target.is_file(), f"Missing OBJ material file: {target}")
        elif fields[0] == "f":
            require(len(fields) == 4, f"OBJ must have triangular faces: {path}:{line_number}")
            indices = []
            for vertex in fields[1:]:
                components = vertex.split("/")
                require(len(components) <= 3, f"Invalid OBJ face token: {vertex}")
                for component_index, component in enumerate(components):
                    if not component:
                        continue
                    index = int(component)
                    size = [len(vertices), len(uv), len(normals)][component_index]
                    require(index != 0 and -size <= index <= size, f"OBJ index out of range: {path}:{line_number}")
                    if component_index == 0:
                        indices.append(index - 1 if index > 0 else size + index)
            require(len(indices) == 3, f"Invalid OBJ triangle: {path}:{line_number}")
            faces.append(indices)
    require(len(vertices) >= 3 and faces, f"Empty OBJ: {path}")
    for indices in faces:
        a, b, c = (vertices[index] for index in indices)
        require(np.linalg.norm(np.cross(b - a, c - a)) > 1e-15, f"Degenerate OBJ triangle: {path}")
    require(len(vertices) == part["vertices"] and len(faces) == part["triangles"], f"OBJ counts disagree with manifest: {path}")
    return np.asarray(vertices), len(faces)


def validate_compiled(reference, model, clothing, mesh_files, overrides):
    for field in ("nbody", "njnt", "nq", "nv", "nu", "neq", "nsensor", "nsensordata", "nsite", "nexclude"):
        require(getattr(model, field) == getattr(reference, field), f"Compiled {field} changed")
    body_fields = (
        "body_parentid", "body_rootid", "body_weldid", "body_mocapid", "body_jntnum", "body_jntadr",
        "body_dofnum", "body_dofadr", "body_pos", "body_quat", "body_ipos", "body_iquat",
        "body_mass", "body_subtreemass", "body_inertia", "body_invweight0", "body_gravcomp",
    )
    for field in body_fields:
        close(getattr(model, field), getattr(reference, field), field, atol=1e-12, rtol=1e-12)
    for prefix in ("jnt_", "dof_", "actuator_", "sensor_", "site_", "eq_", "exclude_"):
        for field in dir(reference):
            # MuJoCo derives this approximate angular scale from geom bounding
            # radii, including massless visual geoms (engine_setconst.c).
            # Actual mass, inertia, damping, armature and actuator arrays remain strict.
            if field != "dof_length" and field.startswith(prefix) and isinstance(getattr(reference, field), np.ndarray):
                close(getattr(model, field), getattr(reference, field), field, atol=1e-12, rtol=1e-12)
    close(model.qpos0, reference.qpos0, "qpos0", atol=1e-12, rtol=1e-12)
    for object_type, count in ((mujoco.mjtObj.mjOBJ_BODY, reference.nbody),
                               (mujoco.mjtObj.mjOBJ_JOINT, reference.njnt),
                               (mujoco.mjtObj.mjOBJ_ACTUATOR, reference.nu),
                               (mujoco.mjtObj.mjOBJ_SENSOR, reference.nsensor)):
        for index in range(count):
            require(mujoco.mj_id2name(model, object_type, index) == mujoco.mj_id2name(reference, object_type, index),
                    f"Compiled object names changed: {object_type}:{index}")
    clothing_names = {part["name"] for part in clothing}
    native_geom_fields = (
        "geom_type", "geom_dataid", "geom_matid", "geom_group", "geom_contype", "geom_conaffinity", "geom_condim",
        "geom_priority", "geom_solmix", "geom_solref", "geom_solimp", "geom_friction", "geom_margin",
        "geom_gap", "geom_size", "geom_pos", "geom_quat",
    )
    # Added geoms shift global indices. Compare native geoms in each unchanged body.
    for body_id in range(reference.nbody):
        expected_ids = np.flatnonzero(reference.geom_bodyid == body_id)
        actual_ids = [int(index) for index in np.flatnonzero(model.geom_bodyid == body_id)
                      if mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, int(index)) not in clothing_names]
        require(len(actual_ids) == len(expected_ids), f"Native geom count changed for body {body_id}")
        for field in native_geom_fields:
            close(getattr(model, field)[actual_ids], getattr(reference, field)[expected_ids], field, atol=1e-12, rtol=1e-12)
        for actual_id, expected_id in zip(actual_ids, expected_ids):
            mesh_name = mujoco.mj_id2name(reference, mujoco.mjtObj.mjOBJ_MESH, int(reference.geom_dataid[expected_id]))
            filename = mesh_files[mesh_name]
            rgba = overrides[filename] if reference.geom_group[expected_id] == 2 and filename in overrides else reference.geom_rgba[expected_id]
            close(model.geom_rgba[actual_id], rgba, f"Native geom {expected_id} visual palette", atol=1e-7)
    require(model.ngeom == reference.ngeom + len(clothing), "Unexpected exported geom count")
    for part in clothing:
        index = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, part["name"])
        require(index >= 0, f"Missing compiled garment: {part['name']}")
        require(model.geom_contype[index] == 0 and model.geom_conaffinity[index] == 0 and model.geom_group[index] == 2,
                f"Garment has collision or wrong visual group: {part['name']}")
        require(mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, int(model.geom_bodyid[index])) == part["bodyName"],
                f"Garment mounted to the wrong body: {part['name']}")
        material_id = model.geom_matid[index]
        require(material_id >= 0, f"Missing garment material: {part['name']}")
        close(model.mat_rgba[material_id], part["rgba"], f"{part['name']} color", atol=1e-7)


def validate_urdf(case, source_xml, reference, manifest, mesh_files, overrides):
    root = ET.parse(case / "microduck.urdf").getroot()
    require(root.tag == "robot", "URDF root must be robot")
    links = {item.get("name"): item for item in root.findall("link")}
    joints = {item.get("name"): item for item in root.findall("joint")}
    require(len(links) == len(root.findall("link")) and len(joints) == len(root.findall("joint")), "Duplicate URDF names")
    require(sum(item.get("type") == "revolute" for item in joints.values()) == 14, "Expected 14 revolute URDF joints")
    require(sum(item.get("type") == "floating" for item in joints.values()) == 1, "Expected one floating URDF root")
    child_to_joint = {item.find("child").get("link"): item for item in joints.values()}
    require(len(child_to_joint) == len(joints), "URDF child has multiple parents")
    require(set(links) - set(child_to_joint) == {"world"}, "URDF must have a single world root")
    for name in links:
        visited = set()
        while name != "world":
            require(name not in visited and name in child_to_joint, "URDF hierarchy contains a cycle or disconnected link")
            visited.add(name)
            name = child_to_joint[name].find("parent").get("link")
            require(name in links, "URDF references an unknown parent")

    def visit(body, parent):
        name = body.get("name")
        require(name in links, f"Missing native URDF link: {name}")
        inertial = body.find("inertial")
        exported = links[name].find("inertial")
        require(inertial is not None and exported is not None, f"Missing native inertia: {name}")
        close(float(exported.find("mass").get("value")), float(inertial.get("mass")), f"{name} URDF mass")
        source_tensor = numbers(inertial.get("fullinertia"))
        if not len(source_tensor):
            source_tensor = np.r_[numbers(inertial.get("diaginertia")), [0, 0, 0]]
        tensor = exported.find("inertia")
        close([float(tensor.get(key)) for key in ("ixx", "iyy", "izz", "ixy", "ixz", "iyz")], source_tensor,
              f"{name} URDF full inertia", atol=1e-13)
        exported_origin = exported.find("origin")
        close(numbers(exported_origin.get("xyz")), numbers(inertial.get("pos"), "0 0 0"), f"{name} center of mass")
        close(rpy_matrix(exported_origin.get("rpy")), quaternion_matrix(inertial.get("quat")), f"{name} inertia orientation")
        native_visuals = [geom for geom in body.findall("geom") if geom.get("class") == "visual"]
        exported_visuals = links[name].findall("visual")
        require(len(native_visuals) == len(exported_visuals), f"Native visual count changed: {name}")
        for geom, visual in zip(native_visuals, exported_visuals):
            filename = mesh_files[geom.get("mesh")]
            require(visual.find("geometry/mesh").get("filename") == f"meshes/robot/{filename}", f"Native visual mesh changed: {name}")
            if filename in overrides:
                close(numbers(visual.find("material/color").get("rgba")), overrides[filename], f"{name} URDF visual palette")
        source_joint = body.find("joint")
        if source_joint is None:
            source_joint = body.find("freejoint")
        joint_name = source_joint.get("name") if source_joint is not None else f"{parent}_to_{name}"
        require(joint_name in joints, f"Missing URDF joint: {joint_name}")
        exported_joint = joints[joint_name]
        require(exported_joint.find("parent").get("link") == parent, f"Wrong URDF parent: {joint_name}")
        pivot = numbers(source_joint.get("pos"), "0 0 0") if source_joint is not None else np.zeros(3)
        expected_pos = numbers(body.get("pos"), "0 0 0") + quaternion_matrix(body.get("quat")) @ pivot
        joint_origin = exported_joint.find("origin")
        close(numbers(joint_origin.get("xyz")), expected_pos, f"{joint_name} position")
        close(rpy_matrix(joint_origin.get("rpy")), quaternion_matrix(body.get("quat")), f"{joint_name} RPY orientation")
        if np.any(np.abs(pivot) > 1e-12):
            pivot_name = f"{name}__pivot"
            require(exported_joint.find("child").get("link") == pivot_name, f"Missing pivot link: {name}")
            fixed = joints[f"{name}_pivot_to_body"]
            close(numbers(fixed.find("origin").get("xyz")), -pivot, f"{name} pivot offset")
        else:
            require(exported_joint.find("child").get("link") == name, f"Wrong URDF child: {joint_name}")
        if source_joint is not None and source_joint.tag != "freejoint":
            index = mujoco.mj_name2id(reference, mujoco.mjtObj.mjOBJ_JOINT, joint_name)
            close(numbers(exported_joint.find("axis").get("xyz")), reference.jnt_axis[index], f"{joint_name} axis")
            limit = exported_joint.find("limit")
            close([float(limit.get("lower")), float(limit.get("upper"))], reference.jnt_range[index], f"{joint_name} range")
            actuator_ids = np.flatnonzero(reference.actuator_trnid[:, 0] == index)
            require(len(actuator_ids) == 1, f"Expected one native actuator: {joint_name}")
            effort = np.max(np.abs(reference.actuator_forcerange[actuator_ids[0]]))
            close(float(limit.get("effort")), effort, f"{joint_name} effort")
            close(float(limit.get("velocity")), 10, f"{joint_name} declared velocity convention")
            dof = reference.jnt_dofadr[index]
            dynamics = exported_joint.find("dynamics")
            close(float(dynamics.get("damping")), reference.dof_damping[dof], f"{joint_name} damping")
            close(float(dynamics.get("friction")), reference.dof_frictionloss[dof], f"{joint_name} friction")
        for child in body.findall("body"):
            visit(child, name)

    for body in source_xml.find("worldbody").findall("body"):
        visit(body, "world")
    for mesh in root.findall(".//mesh"):
        local_file(case, mesh.get("filename"))
        if mesh.get("scale"):
            require(np.all(numbers(mesh.get("scale")) > 0), "Invalid URDF mesh scale")
    for index, part in enumerate(manifest["clothing"]):
        name = f"duckrobe_{part['slot']}_{index}"
        link = links[name]
        require(link.find("inertial") is None and link.find("collision") is None,
                f"URDF garment must be a massless visual link: {name}")
        require(link.find("visual/geometry/mesh").get("filename") == part["path"], f"Wrong garment mesh: {name}")
        mount = joints[f"{name}_mount"]
        require(mount.get("type") == "fixed" and mount.find("parent").get("link") == part["bodyName"],
                f"URDF garment mount is incorrect: {name}")


def validate_preview(case, model, reference, manifest, obj_vertices, compare_dynamics=True):
    key = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_KEY, "duckrobe_preview")
    require(key >= 0, "Missing duckrobe_preview keyframe")
    data = mujoco.MjData(model)
    mujoco.mj_resetDataKeyframe(model, data, key)
    pose = manifest["previewRootPose"]
    require(pose["quaternionOrder"] == "wxyz", "Unexpected preview quaternion order")
    close(data.qpos[:7], [*pose["position"], *pose["quaternion"]], "Preview floating root")
    for name, angle in manifest["previewJointPositions"].items():
        index = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)
        require(index >= 0, f"Unknown preview joint: {name}")
        close(data.qpos[model.jnt_qposadr[index]], angle, f"{name} preview angle")
    native_data = mujoco.MjData(reference)
    native_data.qpos[:] = data.qpos
    if compare_dynamics:
        mujoco.mj_forward(model, data)
        require(np.all(np.isfinite(data.qacc)), "Preview produces non-finite acceleration")
        # Compare real dynamics at matching nonzero velocities and controls as
        # well as kinematics. Geometry-only runs keep the definition guards,
        # then skip these previously established force/matrix comparisons.
        data.qvel[:] = native_data.qvel[:] = np.linspace(-0.02, 0.03, model.nv)
        data.ctrl[:] = native_data.ctrl[:] = 0.05 * np.sin(np.arange(model.nu))
        mujoco.mj_forward(model, data)
        mujoco.mj_forward(reference, native_data)
        for field in ("qfrc_bias", "qfrc_passive", "qfrc_actuator", "actuator_force"):
            close(getattr(data, field), getattr(native_data, field), f"Native physical invariance: {field}", atol=1e-12, rtol=1e-12)
        actual_mass, native_mass = np.empty((model.nv, model.nv)), np.empty((reference.nv, reference.nv))
        mujoco.mj_fullM(model, data, actual_mass)
        mujoco.mj_fullM(reference, native_data, native_mass)
        close(actual_mass, native_mass, "Native physical invariance: full mass matrix", atol=1e-12, rtol=1e-12)
    else:
        mujoco.mj_kinematics(model, data)
        mujoco.mj_kinematics(reference, native_data)
        require(np.all(np.isfinite(data.xpos)) and np.all(np.isfinite(data.xmat)), "Preview produces non-finite body transforms")

    urdf = ET.parse(case / "microduck.urdf").getroot()
    world = {"world": np.eye(4)}
    pending = list(urdf.findall("joint"))
    while pending:
        progress = False
        for joint in list(pending):
            parent = joint.find("parent").get("link")
            if parent not in world:
                continue
            child = joint.find("child").get("link")
            if joint.get("type") == "floating":
                rotation = quaternion_matrix(" ".join(map(str, pose["quaternion"])))
                world[child] = transform(pose["position"], rotation)
            else:
                origin = joint.find("origin")
                local = transform(numbers(origin.get("xyz"), "0 0 0"), rpy_matrix(origin.get("rpy")))
                if joint.get("type") in ("revolute", "continuous"):
                    angle = manifest["previewJointPositions"].get(joint.get("name"), 0)
                    axis = numbers(joint.find("axis").get("xyz"), "0 0 1")
                    local = local @ transform(np.zeros(3), axis_rotation(axis, angle))
                world[child] = world[parent] @ local
            pending.remove(joint)
            progress = True
        require(progress, "Could not evaluate URDF preview hierarchy")
    for index in range(1, model.nbody):
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, index)
        close(world[name][:3, 3], data.xpos[index], f"{name} URDF/MJCF standing position")
        close(world[name][:3, :3], data.xmat[index].reshape(3, 3), f"{name} URDF/MJCF standing rotation")
    for index, part in enumerate(manifest["clothing"]):
        name = f"duckrobe_{part['slot']}_{index}"
        close(world[name], world[part["bodyName"]], f"{name} garment standing mount")

    adjustment = manifest["previewGroundAdjustment"]
    require(isinstance(adjustment, (int, float)) and math.isfinite(adjustment) and adjustment >= 0,
            "Preview ground adjustment must be finite and nonnegative")
    root_height_delta = data.qpos[2] - reference.qpos0[2]
    native_min_z = math.inf
    for geom_id in np.flatnonzero(reference.geom_group == 2):
        mesh_id = reference.geom_dataid[geom_id]
        require(mesh_id >= 0, "Native floor reference must use mesh geometry")
        start, count = reference.mesh_vertadr[mesh_id], reference.mesh_vertnum[mesh_id]
        vertices = reference.mesh_vert[start:start + count]
        matrix = native_data.geom_xmat[geom_id].reshape(3, 3)
        world_z = vertices @ matrix[2, :] + native_data.geom_xpos[geom_id, 2]
        native_min_z = min(native_min_z, float(world_z.min()))
    require(native_min_z >= -1e-7, "Native feet penetrate the preview floor")
    bare_ground_offset = root_height_delta - native_min_z
    shoe_min_z = standing_shoe_min_z = math.inf
    for part in manifest["clothing"]:
        if part["bodyName"] not in ("ankle_left", "ankle_right"):
            continue
        standing = part.get("standingMinZ")
        require(isinstance(standing, (int, float)) and math.isfinite(standing), f"Missing finite shoe standing height: {part['name']}")
        vertices = obj_vertices[part["name"]]
        matrix = world[part["bodyName"]]
        actual_min_z = float((vertices @ matrix[2, :3] + matrix[2, 3]).min())
        close(actual_min_z - root_height_delta, standing, f"{part['name']} body-local OBJ standing height", atol=1e-7)
        require(actual_min_z >= -1e-7, f"Shoe penetrates the preview floor: {part['name']}")
        shoe_min_z = min(shoe_min_z, actual_min_z)
        standing_shoe_min_z = min(standing_shoe_min_z, standing)
    expected_adjustment = max(0, -(standing_shoe_min_z + bare_ground_offset)) if math.isfinite(standing_shoe_min_z) else 0
    close(adjustment, expected_adjustment, "Shoe-derived preview ground adjustment", atol=1e-7)
    floor_min_z = min(native_min_z, shoe_min_z)
    close(floor_min_z, 0, "Native feet or shoes must rest on preview floor", atol=1e-7)
    return {"nativeMinZ": native_min_z, "shoeMinZ": shoe_min_z if math.isfinite(shoe_min_z) else None,
            "adjustment": adjustment, "bareGroundOffset": bare_ground_offset}


def validate_case(case, source_path, source_xml, reference, source_hashes, geometry_only=False):
    started = time.monotonic()
    manifest = json.loads((case / "manifest.json").read_text())
    require(manifest["formatVersion"] == 2, "Expected five-slot export manifest version 2")
    require(manifest["formats"] == {"urdf": "microduck.urdf", "mjcf": "microduck.xml"}, "Both default formats must be present")
    require(manifest["units"] == {"length": "metre", "angle": "radian"}, "Unexpected export units")
    slots = validate_selection(manifest, source_xml)
    for path in manifest["files"]:
        local_file(case, path)
    xml = ET.parse(case / "microduck.xml").getroot()
    mesh_files = source_mesh_files(source_xml)
    overrides = palette_overrides(source_xml, manifest)
    source_sections = [xml_semantics(item) for item in source_xml if item.tag not in ("compiler", "asset", "worldbody", "keyframe")]
    exported_sections = [xml_semantics(item) for item in xml if item.tag not in ("compiler", "asset", "worldbody", "keyframe")]
    require(source_sections == exported_sections, "Native defaults, contacts, sensors, actuators, or other model sections changed")
    native_keys = [xml_semantics(item) for item in source_xml.findall("keyframe/key")]
    exported_native_keys = [xml_semantics(item) for item in xml.findall("keyframe/key") if item.get("name") != "duckrobe_preview"]
    require(native_keys == exported_native_keys, "Native keyframes changed")
    source_compiler = dict(source_xml.find("compiler").attrib)
    exported_compiler = dict(xml.find("compiler").attrib)
    source_compiler.pop("meshdir", None)
    exported_compiler.pop("meshdir", None)
    require(source_compiler == exported_compiler, "Native compiler settings changed")
    meshdir = xml.find("compiler").get("meshdir", "")
    for mesh in xml.findall("asset/mesh"):
        local_file(case, str(Path(meshdir) / mesh.get("file")))
    for filename, digest in source_hashes.items():
        require(hashlib.sha256((case / "meshes/robot" / filename).read_bytes()).hexdigest() == digest,
                f"Native mesh bytes changed: {filename}")
    require((case / "LICENSE-Microduck.txt").read_bytes() == (source_path.parent / "LICENSE").read_bytes(), "Upstream license changed")
    clothing = manifest["clothing"]
    clothing_by_name = {part["name"]: part for part in clothing}
    require(len(clothing_by_name) == len(clothing), "Duplicate garment names")
    exported_bodies = {body.get("name"): body for body in xml.findall(".//worldbody//body")}
    for original_body in source_xml.findall(".//worldbody//body"):
        exported_body = exported_bodies[original_body.get("name")]
        require(original_body.attrib == exported_body.attrib, f"Native body attributes changed: {original_body.get('name')}")
        original_geoms = original_body.findall("geom")
        exported_geoms = [geom for geom in exported_body.findall("geom") if geom.get("name") not in clothing_by_name]
        require(len(original_geoms) == len(exported_geoms), "Native XML geom count changed")
        for original_geom, exported_geom in zip(original_geoms, exported_geoms):
            expected, actual = dict(original_geom.attrib), dict(exported_geom.attrib)
            filename = mesh_files[original_geom.get("mesh")]
            if original_geom.get("class") == "visual" and filename in overrides:
                close(numbers(actual.pop("rgba", None)), overrides[filename], f"{filename} MJCF visual palette")
                expected.pop("rgba", None)
            require(actual == expected, f"Unexpected native geom XML mutation: {filename}")
        for tag in ("inertial", "joint", "freejoint", "site"):
            require([xml_semantics(item) for item in original_body.findall(tag)] ==
                    [xml_semantics(item) for item in exported_body.findall(tag)], f"Native body {tag} changed")
    for body in xml.findall(".//worldbody//body"):
        for geom in body.findall("geom"):
            if geom.get("name") not in clothing_by_name:
                continue
            part = clothing_by_name[geom.get("name")]
            require(body.get("name") == part["bodyName"], "Incorrect MJCF garment parent")
            require(all(geom.get(field) == "0" for field in ("contype", "conaffinity", "mass", "density")),
                    f"Garment must have explicit zero mass/density and contacts: {part['name']}")
            close(numbers(geom.get("pos")), np.zeros(3), f"{part['name']} mesh position")
            close(quaternion_matrix(geom.get("quat")), np.eye(3), f"{part['name']} mesh orientation")
    vertices = triangles = 0
    obj_vertices = {}
    for part in clothing:
        points, f = validate_obj(local_file(case, part["path"]), part)
        obj_vertices[part["name"]] = points
        vertices += len(points)
        triangles += f
    model = mujoco.MjModel.from_xml_path(str(case / "microduck.xml"))
    validate_compiled(reference, model, clothing, mesh_files, overrides)
    validate_urdf(case, source_xml, reference, manifest, mesh_files, overrides)
    floor = validate_preview(case, model, reference, manifest, obj_vertices, compare_dynamics=not geometry_only)
    if not geometry_only:
        # Full runs also evaluate the original zero reference.
        data = mujoco.MjData(model)
        mujoco.mj_forward(model, data)
        require(np.all(np.isfinite(data.qacc)), "Exported model produces non-finite acceleration")
    return {"case": case.name, "garments": len(clothing), "vertices": vertices, "triangles": triangles,
            "slots": slots, "bodyColors": manifest["bodyColors"], "floor": floor,
            "monocularEyewear": manifest["selection"]["eyewear"] is not None,
            "validationMode": "geometry-only" if geometry_only else "full",
            "seconds": round(time.monotonic() - started, 3), "status": "passed"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--report", type=Path, help="Optional JSON report path")
    parser.add_argument("--geometry-only", action="store_true", help="Compile and validate changed visual geometry; retain native definition guards but skip repeated force/mass-matrix comparisons")
    parser.add_argument("--prior-physics-report", type=Path, help="Passing full validation report required for --geometry-only")
    args = parser.parse_args()
    source = args.source.resolve()
    source_digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if args.geometry_only:
        if not args.prior_physics_report:
            parser.error("--geometry-only requires --prior-physics-report from a passing full run")
        prior = json.loads(args.prior_physics_report.read_text())
        prior_mode = prior.get("mode", "full" if "full mass matrix" in prior.get("physicalInvariance", []) else None)
        require(prior_mode == "full" and prior.get("cases", 0) > 0 and prior.get("passed") == prior.get("cases"),
                "Prior physics report must be a passing full validation run")
        require(Path(prior["source"]).resolve() == source and prior["mujocoVersion"] == mujoco.__version__,
                "Prior physics report uses a different native source or MuJoCo version")
        if prior.get("sourceSha256"):
            require(prior["sourceSha256"] == source_digest, "Native source changed since prior physics validation")
        else:
            # The first full v2 report predates source hashes. Accept that
            # report only while the official pinned source checksum matches.
            require(source == DEFAULT_SOURCE.resolve(), "Legacy full reports require the pinned default Microduck source")
            pinned = json.loads((REPO / "public/robot/manifest.json").read_text())
            require(pinned["files"]["source/robot_allcollisions.xml"]["sha256"] == source_digest,
                    "Native source differs from the pinned asset used for prior physics validation")
    source_xml = ET.parse(source).getroot()
    reference = mujoco.MjModel.from_xml_path(str(source))
    source_hashes = {mesh.get("file"): hashlib.sha256((source.parent / "assets" / mesh.get("file")).read_bytes()).hexdigest()
                     for mesh in source_xml.findall("asset/mesh")}
    cases = [args.directory.resolve()] if (args.directory / "microduck.xml").is_file() else sorted(
        path for path in args.directory.resolve().iterdir() if path.is_dir() and (path / "microduck.xml").is_file())
    require(cases, f"No extracted export cases found in {args.directory}")
    started = time.monotonic()
    results = []
    for index, case in enumerate(cases, 1):
        try:
            results.append(validate_case(case, source, source_xml, reference, source_hashes, geometry_only=args.geometry_only))
        except Exception as error:
            results.append({"case": case.name, "status": "failed", "error": str(error)})
            print(f"FAIL {case.name}: {error}", file=sys.stderr, flush=True)
        if index % 10 == 0 or index == len(cases):
            print(f"Validated {index}/{len(cases)} cases", file=sys.stderr, flush=True)
    report = {"mode": "geometry-only" if args.geometry_only else "full", "dynamicsCompared": not args.geometry_only,
              "priorPhysicsValidationReport": str(args.prior_physics_report.resolve()) if args.geometry_only else None,
              "mujocoVersion": mujoco.__version__, "numpyVersion": np.__version__, "source": str(source), "sourceSha256": source_digest,
              "cases": len(cases), "passed": sum(item["status"] == "passed" for item in results),
              "seconds": round(time.monotonic() - started, 3),
              "physicalInvariance": ["native body masses and inertias", "joint kinematics, limits, damping, friction, armature",
                                     "native actuator arrays", "full mass matrix", "gravity/Coriolis qfrc_bias",
                                     "passive forces qfrc_passive", "actuator forces", "URDF/MJCF standing body transforms"] if not args.geometry_only else [],
              "geometryValidation": ["real MJCF compilation", "unchanged native XML definitions and compiled parameters",
                                     "five-slot item mapping and body mounts", "URDF/MJCF standing body transforms",
                                     "base colors", "OBJ faces and relative asset references", "shoe grounding",
                                     "exactly one eyepiece rim and optical lens when eyewear is selected"],
              "floorValidation": "Ankle garment OBJ bounds reproduce standingMinZ and previewGroundAdjustment; native feet and shoes remain above the floor, with the lowest at z=0",
              "derivedFieldExceptions": {"dof_length": "MuJoCo derives approximate angular length scale from geom bounding radii; visual garments enlarge these bounds"},
              "allowedVisualChanges": "Native visual geom rgba values must match manifest.visualPaletteOverrides; collision colors and all other native geom attributes remain unchanged",
              "wardrobeSlots": list(SLOTS),
              "multiBodyLegwearCases": sum(len(item.get("slots", {}).get("legwear", {}).get("bodies", [])) > 1 for item in results),
              "monocularEyewearCases": sum(item.get("monocularEyewear", False) for item in results),
              "bodyColorCombinations": sorted({(item["bodyColors"]["shell"], item["bodyColors"]["accent"])
                                               for item in results if item.get("bodyColors")}),
              "nativeModel": {"bodies": reference.nbody, "joints": reference.njnt, "actuators": reference.nu,
                              "sensors": reference.nsensor, "geoms": reference.ngeom, "massKg": float(reference.body_mass.sum())},
              "results": results}
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.write_text(rendered)
    print(rendered)
    return 0 if report["passed"] == report["cases"] else 1


if __name__ == "__main__":
    sys.exit(main())

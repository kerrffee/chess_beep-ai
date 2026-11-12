# 뼈대 없는 사람 모델(.glb)에 뼈대를 만들어 붙이고 가볍게 줄여서 내보냄 (욕심쟁이2, 핑계왕에 씀)
# 사용: pip install bpy  →  python3 tools/rig-character.py -- <원본.glb> <결과.glb> <greedy2|excuser>
# 그다음 그림 줄이기: npx @gltf-transform/cli resize <결과.glb> <최종.glb> --width 1024 --height 1024
import bpy, bmesh, sys, mathutils
from mathutils import Vector
from mathutils.geometry import intersect_point_line

src, dst, which = sys.argv[sys.argv.index('--') + 1:]

# 관절 위치 (glTF 좌표: x = 캐릭터 왼쪽, y = 위, z = 앞). 원본 모델 단위 m
G2 = {  # 욕심쟁이2 (네모 투구 갑옷 기사)
    'pelvis': (0, -0.08, -0.04), 'spine_01': (0, 0.02, -0.05), 'spine_02': (0, 0.18, -0.06), 'spine_03': (0, 0.35, -0.07),
    'neck_01': (0, 0.60, -0.07), 'head': (0, 0.68, -0.05), 'head_end': (0, 0.92, -0.05),
    'clavicle_l': (0.07, 0.53, -0.07), 'upperarm_l': (0.28, 0.50, -0.08), 'lowerarm_l': (0.36, 0.18, -0.04),
    'hand_l': (0.37, -0.07, 0.04), 'middle_01_l': (0.375, -0.13, 0.05), 'middle_end_l': (0.375, -0.19, 0.05),
    'thigh_l': (0.12, -0.18, -0.03), 'calf_l': (0.19, -0.52, -0.03), 'foot_l': (0.21, -0.83, -0.08), 'ball_l': (0.22, -0.92, 0.15), 'ball_end_l': (0.22, -0.92, 0.30),
}
EX = {  # 핑계왕 (뾰족한 바위 괴물, 걷는 자세: 왼팔·왼다리 앞, 오른팔·오른다리 뒤)
    'pelvis': (0, -0.12, 0.0), 'spine_01': (0, 0.0, 0.02), 'spine_02': (0, 0.17, 0.03), 'spine_03': (0, 0.35, 0.03),
    'neck_01': (0, 0.62, 0.05), 'head': (0, 0.72, 0.08), 'head_end': (0, 0.95, 0.08),
    'clavicle_l': (0.07, 0.55, 0.05), 'upperarm_l': (0.30, 0.50, 0.08), 'lowerarm_l': (0.38, 0.18, 0.16),
    'hand_l': (0.36, -0.08, 0.25), 'middle_01_l': (0.35, -0.16, 0.25), 'middle_end_l': (0.34, -0.26, 0.25),
    'clavicle_r': (-0.07, 0.55, -0.03), 'upperarm_r': (-0.28, 0.50, -0.10), 'lowerarm_r': (-0.33, 0.20, -0.27),
    'hand_r': (-0.37, -0.06, -0.20), 'middle_01_r': (-0.37, -0.15, -0.19), 'middle_end_r': (-0.37, -0.26, -0.18),
    'thigh_l': (0.13, -0.20, 0.07), 'calf_l': (0.22, -0.55, 0.10), 'foot_l': (0.25, -0.85, 0.12), 'ball_l': (0.27, -0.92, 0.28), 'ball_end_l': (0.27, -0.92, 0.40),
    'thigh_r': (-0.13, -0.20, -0.05), 'calf_r': (-0.18, -0.55, -0.18), 'foot_r': (-0.21, -0.85, -0.25), 'ball_r': (-0.25, -0.92, -0.12), 'ball_end_r': (-0.25, -0.92, -0.02),
}
J = dict(G2 if which == 'greedy2' else EX)
# 대칭 모델은 오른쪽을 왼쪽에서 거울로
for k, v in list(J.items()):
    if k.endswith('_l') and k[:-2] + '_r' not in J:
        J[k[:-2] + '_r'] = (-v[0], v[1], v[2])

def B(p):  # glTF → Blender 좌표
    return Vector((p[0], -p[2], p[1]))

# (뼈 이름, 끝점 이름, 부모)
BONES = [('pelvis', 'spine_01', None), ('spine_01', 'spine_02', 'pelvis'), ('spine_02', 'spine_03', 'spine_01'),
         ('spine_03', 'neck_01', 'spine_02'), ('neck_01', 'head', 'spine_03'), ('head', 'head_end', 'neck_01')]
for s in 'lr':
    BONES += [(f'clavicle_{s}', f'upperarm_{s}', 'spine_03'), (f'upperarm_{s}', f'lowerarm_{s}', f'clavicle_{s}'),
              (f'lowerarm_{s}', f'hand_{s}', f'upperarm_{s}'), (f'hand_{s}', f'middle_01_{s}', f'lowerarm_{s}'),
              (f'middle_01_{s}', f'middle_end_{s}', f'hand_{s}'),
              (f'thigh_{s}', f'calf_{s}', 'pelvis'), (f'calf_{s}', f'foot_{s}', f'thigh_{s}'),
              (f'foot_{s}', f'ball_{s}', f'calf_{s}'), (f'ball_{s}', f'ball_end_{s}', f'foot_{s}')]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o != obj: bpy.data.objects.remove(o)
obj.name = which
me = obj.data
# 안 쓰는 UV(두 번째부터)와 접선 지우기
while len(me.uv_layers) > 1: me.uv_layers.remove(me.uv_layers[-1])

# 붙어 있어야 할 점 합치기 (메시가 3조각으로 잘려 있음)
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)

# 욕심쟁이2: 오른손에 든 사슬 향로(무기)는 지움 — 앉으면 바닥을 뚫고, 손을 뻗으면 책상을 뚫어서
if which == 'greedy2':
    # 메시가 한 덩어리라서 위치로 자름: 오른쪽 다리 바깥(x < -0.285), 주먹 아래 ~ 향로 바닥(-0.78 < 높이 < -0.17)
    cut = [v for v in bm.verts if v.co.x < -0.285 and -0.78 < v.co.z < -0.17]
    bmesh.ops.delete(bm, geom=cut, context='VERTS')
    # 자르고 남은 작은 조각도 지움
    bm.verts.ensure_lookup_table()
    seen = set(); small = []
    for v0 in bm.verts:
        if v0 in seen: continue
        isl = []; stack = [v0]; seen.add(v0)
        while stack:
            v = stack.pop(); isl.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w not in seen: seen.add(w); stack.append(w)
        if len(isl) < 300: small += isl
    bmesh.ops.delete(bm, geom=small, context='VERTS')
    print('향로 지운 점:', len(cut), '+ 조각', len(small))
bm.to_mesh(me); bm.free()
print('점', len(me.vertices), '면', len(me.polygons))

# 가볍게: 약 6만 삼각형으로
tris = sum(len(p.vertices) - 2 for p in me.polygons)
mod = obj.modifiers.new('dec', 'DECIMATE'); mod.ratio = min(1.0, 60000 / tris)
bpy.ops.object.modifier_apply(modifier='dec')
print('줄인 뒤 점', len(me.vertices), '면', len(me.polygons))

# 뼈대
arm_data = bpy.data.armatures.new('rig'); arm = bpy.data.objects.new('rig', arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for name, tail, parent in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head = B(J[name]); eb.tail = B(J[tail])
    if parent: eb.parent = arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

# 무게(어느 점이 어느 뼈를 따라 움직일지): 자동 + 빈 곳은 가까운 뼈로
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
segs = {name: (B(J[name]), B(J[tail])) for name, tail, _ in BONES}
def nearest_bone(co):
    best, bd = None, 1e9
    for n, (a, b) in segs.items():
        p, t = intersect_point_line(co, a, b); t = max(0, min(1, t))
        d = (co - (a + (b - a) * t)).length
        if d < bd: best, bd = n, d
    return best
vg = {g.index: g.name for g in obj.vertex_groups}
fixed = 0
for v in me.vertices:
    total = sum(g.weight for g in v.groups)
    if total < 1e-4:
        obj.vertex_groups[nearest_bone(v.co)].add([v.index], 1.0, 'REPLACE'); fixed += 1
print('자동 무게가 빠진 점(가까운 뼈로 채움):', fixed, '/', len(me.vertices))
# 손·팔을 따라가는데 손끝보다 한참 아래 있는 점 = 지우다 남은 무기 조각 → 지움 (손을 뻗으면 판 위에 둥둥 뜸)
low = min(B(J['middle_end_l']).z, B(J['middle_end_r']).z) - 0.08
arm_groups = {g.index for g in obj.vertex_groups if g.name.split('_')[0] in ('upperarm', 'lowerarm', 'hand', 'middle')}
bad = [v.index for v in me.vertices if v.co.z < low and v.groups and max(v.groups, key=lambda g: g.weight).group in arm_groups]
if bad:
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in bad], context='VERTS'); bm.to_mesh(me); bm.free()
print('손을 따라가던 낮은 조각 지움:', len(bad))
bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)

bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_tangents=False, export_animations=False,
                          export_skins=True, export_yup=True, export_image_format='AUTO')
print('저장:', dst)

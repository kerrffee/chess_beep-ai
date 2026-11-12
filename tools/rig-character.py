# 뼈대 없는 사람 모델(.glb)에 뼈대를 만들어 붙이고 가볍게 줄여서 내보냄 (욕심쟁이2, 핑계왕, 겁쟁이2, 돌격대장, 랜덤, 퀸 사랑꾼에 씀)
# 사용: pip install bpy  →  python3 tools/rig-character.py -- <원본.glb> <결과.glb> <greedy2|excuser|coward2|attacker|random|queenlover>
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
C2 = {  # 겁쟁이2 (증기 갑옷 로봇, 오른손은 갈고리, 등에 굴뚝)
    'pelvis': (0, -0.04, 0.0), 'spine_01': (0, 0.05, 0.0), 'spine_02': (0, 0.2, 0.0), 'spine_03': (0, 0.38, 0.0),
    'neck_01': (0, 0.6, 0.0), 'head': (0, 0.66, 0.03), 'head_end': (0, 0.92, 0.03),
    'clavicle_l': (0.07, 0.5, 0.0), 'upperarm_l': (0.32, 0.44, -0.03), 'lowerarm_l': (0.34, 0.18, -0.02),
    'hand_l': (0.45, -0.08, 0.04), 'middle_01_l': (0.47, -0.2, 0.06), 'middle_end_l': (0.47, -0.36, 0.08),
    'clavicle_r': (-0.07, 0.5, 0.0), 'upperarm_r': (-0.32, 0.44, -0.03), 'lowerarm_r': (-0.31, 0.18, -0.02),
    'hand_r': (-0.37, -0.1, 0.06), 'middle_01_r': (-0.42, -0.25, 0.1), 'middle_end_r': (-0.42, -0.45, 0.13),
    'thigh_l': (0.17, -0.08, 0.0), 'calf_l': (0.18, -0.38, 0.04), 'foot_l': (0.2, -0.77, -0.03), 'ball_l': (0.2, -0.9, 0.15), 'ball_end_l': (0.2, -0.9, 0.28),
}
AT = {  # 돌격대장 (버섯이 핀 기사, 왼팔에 방패)
    'pelvis': (0, -0.15, -0.06), 'spine_01': (0, 0.0, -0.06), 'spine_02': (0, 0.17, -0.06), 'spine_03': (0, 0.35, -0.06),
    'neck_01': (0, 0.57, -0.04), 'head': (0, 0.64, 0.0), 'head_end': (0, 0.92, 0.0),
    'clavicle_l': (0.07, 0.5, -0.06), 'upperarm_l': (0.22, 0.46, -0.06), 'lowerarm_l': (0.27, 0.2, -0.04),
    'hand_l': (0.28, 0.13, 0.06), 'middle_01_l': (0.28, 0.13, 0.12), 'middle_end_l': (0.28, 0.13, 0.18),
    'clavicle_r': (-0.07, 0.5, -0.06), 'upperarm_r': (-0.23, 0.46, -0.06), 'lowerarm_r': (-0.31, 0.18, -0.05),
    'hand_r': (-0.36, -0.03, -0.02), 'middle_01_r': (-0.37, -0.09, -0.01), 'middle_end_r': (-0.37, -0.14, 0.0),
    'thigh_l': (0.1, -0.22, -0.05), 'calf_l': (0.12, -0.5, -0.04), 'foot_l': (0.14, -0.83, -0.08), 'ball_l': (0.15, -0.92, 0.06), 'ball_end_l': (0.15, -0.92, 0.15),
}
RD = {  # 랜덤 (두건 쓴 방랑자. 오른손에 든 깃대는 지움, 왼발이 앞)
    'pelvis': (0, -0.15, 0.05), 'spine_01': (0, -0.05, 0.05), 'spine_02': (0, 0.1, 0.05), 'spine_03': (0, 0.24, 0.05),
    'neck_01': (0, 0.38, 0.04), 'head': (0, 0.45, 0.04), 'head_end': (0, 0.68, 0.04),
    'clavicle_l': (0.05, 0.33, 0.05), 'upperarm_l': (0.17, 0.3, 0.04), 'lowerarm_l': (0.22, 0.06, 0.04),
    'hand_l': (0.17, -0.15, 0.1), 'middle_01_l': (0.16, -0.22, 0.12), 'middle_end_l': (0.16, -0.29, 0.13),
    'clavicle_r': (-0.05, 0.33, 0.05), 'upperarm_r': (-0.17, 0.3, 0.04), 'lowerarm_r': (-0.23, 0.1, 0.02),
    'hand_r': (-0.29, 0.1, 0.15), 'middle_01_r': (-0.31, 0.08, 0.2), 'middle_end_r': (-0.32, 0.06, 0.25),
    'thigh_l': (0.09, -0.2, 0.06), 'calf_l': (0.11, -0.55, 0.08), 'foot_l': (0.14, -0.85, 0.05), 'ball_l': (0.15, -0.92, 0.16), 'ball_end_l': (0.15, -0.92, 0.23),
    'thigh_r': (-0.09, -0.2, 0.03), 'calf_r': (-0.15, -0.55, -0.06), 'foot_r': (-0.19, -0.85, -0.13), 'ball_r': (-0.2, -0.92, -0.04), 'ball_end_r': (-0.2, -0.92, 0.01),
}
QL = {  # 퀸 사랑꾼 (후광을 쓴 망토 군주, 두 팔을 앞으로 벌림, 왼발이 앞)
    'pelvis': (0, -0.15, 0.1), 'spine_01': (0, -0.03, 0.1), 'spine_02': (0, 0.12, 0.1), 'spine_03': (0, 0.28, 0.1),
    'neck_01': (0, 0.45, 0.1), 'head': (0, 0.52, 0.1), 'head_end': (0, 0.72, 0.1),
    'clavicle_l': (0.05, 0.4, 0.1), 'upperarm_l': (0.14, 0.38, 0.1), 'lowerarm_l': (0.25, 0.22, 0.22),
    'hand_l': (0.36, 0.08, 0.32), 'middle_01_l': (0.41, 0.05, 0.36), 'middle_end_l': (0.46, 0.05, 0.4),
    'clavicle_r': (-0.05, 0.4, 0.1), 'upperarm_r': (-0.14, 0.38, 0.08), 'lowerarm_r': (-0.26, 0.22, 0.1),
    'hand_r': (-0.36, 0.08, 0.14), 'middle_01_r': (-0.41, 0.05, 0.16), 'middle_end_r': (-0.46, 0.05, 0.18),
    'thigh_l': (0.1, -0.2, 0.1), 'calf_l': (0.17, -0.52, 0.12), 'foot_l': (0.27, -0.85, 0.15), 'ball_l': (0.28, -0.92, 0.26), 'ball_end_l': (0.28, -0.92, 0.34),
    'thigh_r': (-0.1, -0.2, 0.08), 'calf_r': (-0.17, -0.52, 0.04), 'foot_r': (-0.25, -0.85, -0.06), 'ball_r': (-0.26, -0.92, 0.03), 'ball_end_r': (-0.26, -0.92, 0.08),
}
J = dict({'greedy2': G2, 'excuser': EX, 'coward2': C2, 'attacker': AT, 'random': RD, 'queenlover': QL}[which])
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
# UV는 하나만 남김. Fab 변환 모델은 첫 번째 UV가 그림과 안 맞고(입히면 흙색 한 가지가 됨)
# 두 번째 UV가 진짜 그림 좌표라서, UV가 여러 벌이면 두 번째를 남김 (2026-11-12 색이 생략돼 보이던 문제)
keep = me.uv_layers[1].name if len(me.uv_layers) > 1 else me.uv_layers[0].name
for name in [l.name for l in me.uv_layers if l.name != keep]:
    me.uv_layers.remove(me.uv_layers[name])
me.uv_layers.active = me.uv_layers[keep]
me.uv_layers[keep].active_render = True

# 붙어 있어야 할 점 합치기 (메시가 3조각으로 잘려 있음)
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)

# 욕심쟁이2: 오른손에 든 사슬 향로(무기)는 지움 — 앉으면 바닥을 뚫고, 손을 뻗으면 책상을 뚫어서
if which == 'greedy2':
    # 메시가 한 덩어리라서 위치로 자름: 오른쪽 다리 바깥(x < -0.285), 주먹 아래 ~ 향로 바닥(-0.78 < 높이 < -0.17)
    cut = [v for v in bm.verts if v.co.x < -0.285 and -0.78 < v.co.z < -0.17]
    bmesh.ops.delete(bm, geom=cut, context='VERTS')
    print('향로 지운 점:', len(cut))
# 랜덤: 오른손에 든 긴 깃대와 깃발, 왼쪽 옆 넝마 자락을 지움 (앉으면 바닥·천장을 뚫고, 팔을 움직이면 늘어나서)
if which == 'random':
    def flag(c):  # c: Blender 좌표 → glTF로 (x, 높이 = c.z, 앞 = -c.y)
        x, y, z = c.x, c.z, -c.y
        pole = -0.335 < x < -0.275 and 0.13 < z < 0.21 and not (0.06 < y < 0.13)  # 깃대 (주먹 속 부분만 남김)
        top = y > 0.69 and z > 0.11                                               # 깃대 꼭대기 가로대
        cloth = x < -0.25 and y > 0.2 and z > 0.03                                # 늘어진 깃발 천
        rag = x > 0.27 and y < 0.12                                               # 왼쪽 옆에 늘어진 넝마 자락 (팔을 움직이면 부채처럼 늘어나서)
        return pole or top or cloth or rag
    cut = [v for v in bm.verts if flag(v.co)]
    bmesh.ops.delete(bm, geom=cut, context='VERTS')
    print('깃대·넝마 지운 점:', len(cut))
# 자르고 남은 작은 조각도 지움
if which in ('greedy2', 'random'):
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
    print('작은 조각 지운 점:', len(small))
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
low = min(B(J['middle_end_l']).z, B(J['middle_end_r']).z) - (0.08 if which in ('greedy2', 'excuser') else 0.12)
arm_groups = {g.index for g in obj.vertex_groups if g.name.split('_')[0] in ('upperarm', 'lowerarm', 'hand', 'middle')}
bad = [v.index for v in me.vertices if v.co.z < low and v.groups and max(v.groups, key=lambda g: g.weight).group in arm_groups]
if bad and which not in ('greedy2', 'excuser'):
    # 새 모델들: 무기 조각이 아니라 망토·옷자락이라 지우지 않고, 팔 말고 가장 가까운 몸 뼈를 따라가게 바꿈
    body = {n: ab for n, ab in segs.items() if n.split('_')[0] not in ('upperarm', 'lowerarm', 'hand', 'middle', 'clavicle')}
    for i in bad:
        co = me.vertices[i].co
        best = min(body, key=lambda n: (co - (body[n][0] + (body[n][1] - body[n][0]) * max(0, min(1, intersect_point_line(co, *body[n])[1])))).length)
        for g in list(me.vertices[i].groups): obj.vertex_groups[g.group].remove([i])
        obj.vertex_groups[best].add([i], 1.0, 'REPLACE')
    print('손보다 낮은데 팔을 따라가던 점 → 몸 뼈로:', len(bad))
    bad = []
if bad:
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in bad], context='VERTS'); bm.to_mesh(me); bm.free()
print('손을 따라가던 낮은 조각 지움:', len(bad))
# 퀸 사랑꾼: 어깨 위(후광·왕관)는 전부 머리를 따라가게, 팔에서 먼 망토 자락은 팔 말고 몸을 따라가게
if which in ('queenlover', 'random'):
    body = {n: ab for n, ab in segs.items() if n.split('_')[0] not in ('upperarm', 'lowerarm', 'hand', 'middle', 'clavicle')}
    armseg = {n: ab for n, ab in segs.items() if n not in body}
    def seg_d(co, ab):
        t = max(0, min(1, intersect_point_line(co, *ab)[1])); return (co - (ab[0] + (ab[1] - ab[0]) * t)).length
    gname = {g.index: g.name for g in obj.vertex_groups}
    head_n = far_n = 0
    for v in me.vertices:
        if not v.groups: continue
        if which == 'queenlover' and v.co.z > 0.52:
            for g in list(v.groups): obj.vertex_groups[g.group].remove([v.index])
            obj.vertex_groups['head'].add([v.index], 1.0, 'REPLACE'); head_n += 1; continue
        top = gname[max(v.groups, key=lambda g: g.weight).group]
        # 어깨 뒤 망토: 위팔·빗장뼈를 따라가는데 그 뼈보다 4cm 넘게 뒤에 있음 (팔을 앞으로 뻗으면 망토가 벽처럼 늘어나서)
        cape = top.split('_')[0] in ('upperarm', 'clavicle') and v.co.y - max(segs[top][0].y, segs[top][1].y) > 0.04
        far = min(seg_d(v.co, ab) for ab in armseg.values()) > 0.1
        if top not in armseg and far:
            # 몸을 주로 따라가는데 팔 무게가 조금 섞인 먼 점 → 팔 무게만 뺌 (팔을 크게 움직이면 판처럼 끌려 나와서)
            for g in list(v.groups):
                if gname[g.group] in armseg: obj.vertex_groups[g.group].remove([v.index])
            continue
        if cape or (top in armseg and far):
            best = min(body, key=lambda n: seg_d(v.co, body[n]))
            for g in list(v.groups): obj.vertex_groups[g.group].remove([v.index])
            obj.vertex_groups[best].add([v.index], 1.0, 'REPLACE'); far_n += 1
    print('머리로 고정:', head_n, '/ 팔에서 먼 자락 → 몸 뼈로:', far_n)
# 퀸 사랑꾼: 팔 무게를 거리로 다시 정함 (2026-11-12). 랜덤에 써 보니 팔 옆 넝마 천이 세로로 늘어나서 퀸 사랑꾼만
# 자동 무게는 망토에 덮인 위팔을 몸에 붙여서, 팔을 뻗으면 어깨~팔꿈치가 판처럼 늘어났음
# → 팔 뼈 둘레 QL_ARM_R 안의 점은 팔을 따라가고(경계는 부드럽게), 그 밖(망토 자락)은 팔 무게를 빼고 몸을 따라감
QL_ARM_R = (0.07, 0.10)   # 위팔·아래팔: 이 거리(m)까지는 팔, 끝에서 0
QL_HAND_R = (0.10, 0.14)  # 손·손가락(발톱이 길어서 넓게)
if which == 'queenlover':
    gname = {g.index: g.name for g in obj.vertex_groups}
    ARMP = ('upperarm', 'lowerarm', 'hand', 'middle')
    isarm = lambda n: n.split('_')[0] in ARMP
    body = {n: ab for n, ab in segs.items() if not isarm(n) and not n.startswith('clavicle')}
    def dist(co, ab):
        t = max(0, min(1, intersect_point_line(co, *ab)[1])); return (co - (ab[0] + (ab[1] - ab[0]) * t)).length
    ramp = lambda x, lo, hi: max(0.0, min(1.0, (hi - x) / (hi - lo)))
    n_arm = 0
    for v in me.vertices:
        if v.co.z > 0.52: continue  # 후광·왕관은 머리
        best = None
        for s in 'lr':
            ks = {f'upperarm_{s}': ramp(dist(v.co, segs[f'upperarm_{s}']), *QL_ARM_R),
                  f'lowerarm_{s}': ramp(dist(v.co, segs[f'lowerarm_{s}']), *QL_ARM_R),
                  f'hand_{s}': ramp(min(dist(v.co, segs[f'hand_{s}']), dist(v.co, segs[f'middle_01_{s}'])), *QL_HAND_R)}
            a = max(ks.values())
            if best is None or a > best[0]: best = (a, ks)
        a, ks = best
        gs = [(gname[g.group], g.weight) for g in v.groups]
        rest = [(n, w) for n, w in gs if not isarm(n)]
        rw = sum(w for _, w in rest)
        for n, _ in gs: obj.vertex_groups[n].remove([v.index])
        if a < 1:
            if rw < 1e-4:
                rest = [(min(body, key=lambda n: dist(v.co, body[n])), 1.0)]; rw = 1.0
            for n, w in rest: obj.vertex_groups[n].add([v.index], (1 - a) * w / rw, 'ADD')
        if a > 0:
            tot = sum(ks.values())
            for n, k in ks.items():
                if k > 0: obj.vertex_groups[n].add([v.index], a * k / tot, 'ADD')
            n_arm += 1
    print('팔 무게를 거리로 다시 정한 점:', n_arm)
bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)

bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_tangents=False, export_animations=False,
                          export_skins=True, export_yup=True, export_image_format='AUTO')
print('저장:', dst)

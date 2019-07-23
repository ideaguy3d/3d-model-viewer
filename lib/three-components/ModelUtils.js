/*
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Skeleton } from 'three';
/**
 * Fully clones a parsed GLTF, including correct cloning of any SkinnedMesh
 * objects.
 *
 * NOTE(cdata): This is necessary due to limitations of the Three.js clone
 * routine on scenes. Without it, models with skeletal animations will not be
 * cloned properly.
 *
 * @see https://github.com/mrdoob/three.js/issues/5878
 */
export const cloneGltf = (gltf) => {
    const hasScene = gltf.scene != null;
    const clone = Object.assign({}, gltf, { scene: hasScene ? gltf.scene.clone(true) : null });
    const skinnedMeshes = {};
    let hasSkinnedMeshes = false;
    if (hasScene) {
        gltf.scene.traverse((node) => {
            // Set a high renderOrder while we're here to ensure the model
            // always renders on top of the skysphere
            node.renderOrder = 1000;
            // Materials aren't cloned when cloning meshes; geometry
            // and materials are copied by reference. This is necessary
            // for the same model to be used twice with different
            // environment maps.
            if (Array.isArray(node.material)) {
                node.material =
                    node.material.map((material) => material.clone());
            }
            else if (node.material != null) {
                node.material = node.material.clone();
            }
            if (node.isSkinnedMesh) {
                hasSkinnedMeshes = true;
                skinnedMeshes[node.name] = node;
            }
        });
    }
    const cloneBones = {};
    const cloneSkinnedMeshes = {};
    if (hasScene && hasSkinnedMeshes) {
        clone.scene.traverse((node) => {
            if (node.isBone) {
                cloneBones[node.name] = node;
            }
            if (node.isSkinnedMesh) {
                cloneSkinnedMeshes[node.name] = node;
            }
        });
    }
    for (let name in skinnedMeshes) {
        const skinnedMesh = skinnedMeshes[name];
        const skeleton = skinnedMesh.skeleton;
        const cloneSkinnedMesh = cloneSkinnedMeshes[name];
        const orderedCloneBones = [];
        for (let i = 0; i < skeleton.bones.length; ++i) {
            const cloneBone = cloneBones[skeleton.bones[i].name];
            orderedCloneBones.push(cloneBone);
        }
        cloneSkinnedMesh.bind(new Skeleton(orderedCloneBones, skeleton.boneInverses), cloneSkinnedMesh.matrixWorld);
    }
    return clone;
};
//# sourceMappingURL=ModelUtils.js.map
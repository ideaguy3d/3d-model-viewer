import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadWithLoader } from '../../three-components/CachingGLTFLoader.js';
import { cloneGltf } from '../../three-components/ModelUtils.js';
import { assetPath } from '../helpers.js';
const expect = chai.expect;
const ASTRONAUT_GLB_PATH = assetPath('Astronaut.glb');
const collectMaterials = (scene) => {
    const materials = [];
    scene.traverse((node) => {
        if (Array.isArray(node.material)) {
            materials.push(...node.material);
        }
        else if (node.material != null) {
            materials.push(node.material);
        }
    });
    return materials;
};
suite('ModelUtils', () => {
    suite('cloneGltf', () => {
        let loader;
        let gltf;
        setup(async () => {
            loader = new GLTFLoader();
            gltf = await loadWithLoader(ASTRONAUT_GLB_PATH, loader);
        });
        test('makes unique copies of all materials', () => {
            const clonedGltf = cloneGltf(gltf);
            const sourceMaterials = collectMaterials(gltf.scene);
            const clonedMaterials = collectMaterials(clonedGltf.scene);
            expect(sourceMaterials.length).to.be.greaterThan(0);
            expect(sourceMaterials.length).to.be.equal(clonedMaterials.length);
            sourceMaterials.forEach((material, index) => {
                expect(clonedMaterials[index]).to.not.be.eql(material);
            });
        });
    });
});
//# sourceMappingURL=ModelUtils-spec.js.map
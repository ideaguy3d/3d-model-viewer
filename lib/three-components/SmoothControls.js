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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
import { EventDispatcher, Quaternion, Spherical, Vector2, Vector3 } from 'three';
import { clamp } from '../utilities.js';
export const DEFAULT_OPTIONS = Object.freeze({
    minimumRadius: 1,
    maximumRadius: 2,
    minimumPolarAngle: Math.PI / 8,
    maximumPolarAngle: Math.PI - Math.PI / 8,
    minimumAzimuthalAngle: -Infinity,
    maximumAzimuthalAngle: Infinity,
    minimumFov: 20,
    maximumFov: 45,
    eventHandlingBehavior: 'prevent-all',
    interactionPolicy: 'always-allow'
});
const $velocity = Symbol('v');
// Internal orbital position state
const $spherical = Symbol('spherical');
const $goalSpherical = Symbol('goalSpherical');
const $thetaDamper = Symbol('thetaDamper');
const $phiDamper = Symbol('phiDamper');
const $radiusDamper = Symbol('radiusDamper');
const $fov = Symbol('fov');
const $goalFov = Symbol('goalFov');
const $fovDamper = Symbol('fovDamper');
const $target = Symbol('target');
const $options = Symbol('options');
const $upQuaternion = Symbol('upQuaternion');
const $upQuaternionInverse = Symbol('upQuaternionInverse');
const $touchMode = Symbol('touchMode');
const $canInteract = Symbol('canInteract');
const $interactionEnabled = Symbol('interactionEnabled');
const $zoomMeters = Symbol('zoomMeters');
const $userAdjustOrbit = Symbol('userAdjustOrbit');
const $isUserChange = Symbol('isUserChange');
const $isStationary = Symbol('isMoving');
const $moveCamera = Symbol('moveCamera');
// Pointer state
const $pointerIsDown = Symbol('pointerIsDown');
const $lastPointerPosition = Symbol('lastPointerPosition');
const $lastTouches = Symbol('lastTouches');
// Value conversion methods
const $pixelLengthToSphericalAngle = Symbol('pixelLengthToSphericalAngle');
const $sphericalToPosition = Symbol('sphericalToPosition');
const $twoTouchDistance = Symbol('twoTouchDistance');
// Event handlers
const $onMouseMove = Symbol('onMouseMove');
const $onMouseDown = Symbol('onMouseDown');
const $onMouseUp = Symbol('onMouseUp');
const $onTouchStart = Symbol('onTouchStart');
const $onTouchEnd = Symbol('onTouchEnd');
const $onTouchMove = Symbol('onTouchMove');
const $onWheel = Symbol('onWheel');
const $onKeyDown = Symbol('onKeyDown');
const $handlePointerMove = Symbol('handlePointerMove');
const $handlePointerDown = Symbol('handlePointerDown');
const $handlePointerUp = Symbol('handlePointerUp');
const $handleWheel = Symbol('handleWheel');
const $handleKey = Symbol('handleKey');
// Constants
const TOUCH_EVENT_RE = /^touch(start|end|move)$/;
const KEYBOARD_ORBIT_INCREMENT = Math.PI / 8;
const DECAY_MILLISECONDS = 50;
const NATURAL_FREQUENCY = 1 / DECAY_MILLISECONDS;
const NIL_SPEED = 0.0002 * NATURAL_FREQUENCY;
const TAU = 2 * Math.PI;
const UP = new Vector3(0, 1, 0);
export const KeyCode = {
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40
};
export const ChangeSource = {
    USER_INTERACTION: 'user-interaction',
    NONE: 'none'
};
/**
 * The Damper class is a generic second-order critically damped system that does
 * one linear step of the desired length of time. The only parameter is
 * DECAY_MILLISECONDS, which should be adjustable: TODO(#580). This common
 * parameter makes all states converge at the same rate regardless of scale.
 * xNormalization is a number to provide the rough scale of x, such that
 * NIL_SPEED clamping also happens at roughly the same convergence for all
 * states.
 */
export class Damper {
    constructor() {
        this[_a] = 0;
    }
    update(x, xGoal, timeStepMilliseconds, xNormalization) {
        if (x == null) {
            return xGoal;
        }
        if (timeStepMilliseconds < 0) {
            return x;
        }
        // Exact solution to a critically damped second-order system, where:
        // acceleration = NATURAL_FREQUENCY * NATURAL_FREQUENCY * (xGoal - x) -
        // 2 * NATURAL_FREQUENCY * this[$velocity];
        const deltaX = (x - xGoal);
        const intermediateVelocity = this[$velocity] + NATURAL_FREQUENCY * deltaX;
        const intermediateX = deltaX + timeStepMilliseconds * intermediateVelocity;
        const decay = Math.exp(-NATURAL_FREQUENCY * timeStepMilliseconds);
        const newVelocity = (intermediateVelocity - NATURAL_FREQUENCY * intermediateX) * decay;
        const acceleration = -NATURAL_FREQUENCY * (newVelocity + intermediateVelocity * decay);
        if (Math.abs(newVelocity) < NIL_SPEED * xNormalization &&
            acceleration * deltaX >= 0) {
            // This ensures the controls settle and stop calling this function instead
            // of asymptotically approaching their goal.
            this[$velocity] = 0;
            return xGoal;
        }
        else {
            this[$velocity] = newVelocity;
            return xGoal + intermediateX * decay;
        }
    }
}
_a = $velocity;
/**
 * SmoothControls is a Three.js helper for adding delightful pointer and
 * keyboard-based input to a staged Three.js scene. Its API is very similar to
 * OrbitControls, but it offers more opinionated (subjectively more delightful)
 * defaults, easy extensibility and subjectively better out-of-the-box keyboard
 * support.
 *
 * One important change compared to OrbitControls is that the `update` method
 * of SmoothControls must be invoked on every frame, otherwise the controls
 * will not have an effect.
 *
 * Another notable difference compared to OrbitControls is that SmoothControls
 * does not currently support panning (but probably will in a future revision).
 *
 * Like OrbitControls, SmoothControls assumes that the orientation of the camera
 * has been set in terms of position, rotation and scale, so it is important to
 * ensure that the camera's matrixWorld is in sync before using SmoothControls.
 */
export class SmoothControls extends EventDispatcher {
    constructor(camera, element) {
        super();
        this.camera = camera;
        this.element = element;
        this[_b] = false;
        this[_c] = new Quaternion();
        this[_d] = new Quaternion();
        this[_e] = false;
        this[_f] = new Spherical();
        this[_g] = new Spherical();
        this[_h] = new Damper();
        this[_j] = new Damper();
        this[_k] = new Damper();
        this[_l] = new Damper();
        this[_m] = new Vector3();
        this[_o] = false;
        this[_p] = new Vector2();
        this[_q] = 1;
        this[$upQuaternion].setFromUnitVectors(camera.up, UP);
        this[$upQuaternionInverse].copy(this[$upQuaternion]).inverse();
        this[$onMouseMove] = (event) => this[$handlePointerMove](event);
        this[$onMouseDown] = (event) => this[$handlePointerDown](event);
        this[$onMouseUp] = (event) => this[$handlePointerUp](event);
        this[$onWheel] = (event) => this[$handleWheel](event);
        this[$onKeyDown] = (event) => this[$handleKey](event);
        this[$onTouchStart] = (event) => this[$handlePointerDown](event);
        this[$onTouchEnd] = (event) => this[$handlePointerUp](event);
        this[$onTouchMove] = (event) => this[$handlePointerMove](event);
        this[$options] = Object.assign({}, DEFAULT_OPTIONS);
        this.setOrbit(0, Math.PI / 2, 1);
        this.setFov(100);
        this.jumpToGoal();
    }
    get interactionEnabled() {
        return this[$interactionEnabled];
    }
    enableInteraction() {
        if (this[$interactionEnabled] === false) {
            const { element } = this;
            element.addEventListener('mousemove', this[$onMouseMove]);
            element.addEventListener('mousedown', this[$onMouseDown]);
            element.addEventListener('wheel', this[$onWheel]);
            element.addEventListener('keydown', this[$onKeyDown]);
            element.addEventListener('touchstart', this[$onTouchStart]);
            element.addEventListener('touchmove', this[$onTouchMove]);
            self.addEventListener('mouseup', this[$onMouseUp]);
            self.addEventListener('touchend', this[$onTouchEnd]);
            this.element.style.cursor = 'grab';
            this[$interactionEnabled] = true;
        }
    }
    disableInteraction() {
        if (this[$interactionEnabled] === true) {
            const { element } = this;
            element.removeEventListener('mousemove', this[$onMouseMove]);
            element.removeEventListener('mousedown', this[$onMouseDown]);
            element.removeEventListener('wheel', this[$onWheel]);
            element.removeEventListener('keydown', this[$onKeyDown]);
            element.removeEventListener('touchstart', this[$onTouchStart]);
            element.removeEventListener('touchmove', this[$onTouchMove]);
            self.removeEventListener('mouseup', this[$onMouseUp]);
            self.removeEventListener('touchend', this[$onTouchEnd]);
            element.style.cursor = '';
            this[$interactionEnabled] = false;
        }
    }
    /**
     * The options that are currently configured for the controls instance.
     */
    get options() {
        return this[$options];
    }
    /**
     * Copy the spherical values that represent the current camera orbital
     * position relative to the configured target into a provided Spherical
     * instance. If no Spherical is provided, a new Spherical will be allocated
     * to copy the values into. The Spherical that values are copied into is
     * returned.
     */
    getCameraSpherical(target = new Spherical()) {
        return target.copy(this[$spherical]);
    }
    /**
     * Returns the camera's current vertical field of view in degrees.
     */
    getFieldOfView() {
        return this.camera.fov;
    }
    /**
     * Configure the options of the controls. Configured options will be
     * merged with whatever options have already been configured for this
     * controls instance.
     */
    applyOptions(options) {
        Object.assign(this[$options], options);
        // Re-evaluates clamping based on potentially new values for min/max
        // polar, azimuth and radius:
        this.setOrbit();
        // Prevent interpolation in the case that any target spherical values
        // changed (preserving OrbitalControls behavior):
        if (this[$isStationary]()) {
            return;
        }
        this[$spherical].copy(this[$goalSpherical]);
        this[$moveCamera]();
    }
    /**
     * Sets the non-interpolated camera parameters
     */
    updateIntrinsics(nearPlane, farPlane, aspect, zoomSensitivity) {
        this[$zoomMeters] = zoomSensitivity;
        this.camera.near = nearPlane;
        this.camera.far = farPlane;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
    /**
     * Set the absolute orbital goal of the camera. The change will be
     * applied over a number of frames depending on configured acceleration and
     * dampening options.
     *
     * Returns true if invoking the method will result in the camera changing
     * position and/or rotation, otherwise false.
     */
    setOrbit(goalTheta = this[$goalSpherical].theta, goalPhi = this[$goalSpherical].phi, goalRadius = this[$goalSpherical].radius) {
        const { minimumAzimuthalAngle, maximumAzimuthalAngle, minimumPolarAngle, maximumPolarAngle, minimumRadius, maximumRadius } = this[$options];
        const { theta, phi, radius } = this[$goalSpherical];
        const nextTheta = clamp(goalTheta, minimumAzimuthalAngle, maximumAzimuthalAngle);
        const nextPhi = clamp(goalPhi, minimumPolarAngle, maximumPolarAngle);
        const nextRadius = clamp(goalRadius, minimumRadius, maximumRadius);
        if (nextTheta === theta && nextPhi === phi && nextRadius === radius) {
            return false;
        }
        this[$goalSpherical].theta = nextTheta;
        this[$goalSpherical].phi = nextPhi;
        this[$goalSpherical].radius = nextRadius;
        this[$goalSpherical].makeSafe();
        this[$isUserChange] = false;
        return true;
    }
    /**
     * Subset of setOrbit() above, which only sets the camera's radius.
     */
    setRadius(radius) {
        this[$goalSpherical].radius = radius;
        this.setOrbit();
    }
    /**
     * Sets the goal field of view for the camera
     */
    setFov(fov) {
        const { minimumFov, maximumFov } = this[$options];
        this[$goalFov] = clamp(fov, minimumFov, maximumFov);
    }
    /**
     * Sets the target the camera is pointing toward
     */
    setTarget(target) {
        if (!this[$target].equals(target)) {
            this[$target].copy(target);
            this[$moveCamera]();
        }
    }
    /**
     * Returns a copy of the target position the camera is pointed toward
     */
    getTarget() {
        return this[$target].clone();
    }
    /**
     * Adjust the orbital position of the camera relative to its current orbital
     * position.
     */
    adjustOrbit(deltaTheta, deltaPhi, deltaRadius) {
        const { theta, phi, radius } = this[$goalSpherical];
        const goalTheta = theta - deltaTheta;
        const goalPhi = phi - deltaPhi;
        const goalRadius = radius + deltaRadius;
        return this.setOrbit(goalTheta, goalPhi, goalRadius);
    }
    /**
     * Move the camera instantly instead of accelerating toward the goal
     * parameters.
     */
    jumpToGoal() {
        this.update(0, 100 * DECAY_MILLISECONDS);
    }
    /**
     * Update controls. In most cases, this will result in the camera
     * interpolating its position and rotation until it lines up with the
     * designated goal orbital position.
     *
     * Time and delta are measured in milliseconds.
     */
    update(_time, delta) {
        if (this[$isStationary]()) {
            return;
        }
        const { maximumPolarAngle, maximumRadius, maximumFov } = this[$options];
        this[$spherical].theta = this[$thetaDamper].update(this[$spherical].theta, this[$goalSpherical].theta, delta, Math.PI);
        this[$spherical].phi = this[$phiDamper].update(this[$spherical].phi, this[$goalSpherical].phi, delta, maximumPolarAngle);
        this[$spherical].radius = this[$radiusDamper].update(this[$spherical].radius, this[$goalSpherical].radius, delta, maximumRadius);
        this[$fov] =
            this[$fovDamper].update(this[$fov], this[$goalFov], delta, maximumFov);
        this[$moveCamera]();
    }
    [(_b = $interactionEnabled, _c = $upQuaternion, _d = $upQuaternionInverse, _e = $isUserChange, _f = $spherical, _g = $goalSpherical, _h = $thetaDamper, _j = $phiDamper, _k = $radiusDamper, _l = $fovDamper, _m = $target, _o = $pointerIsDown, _p = $lastPointerPosition, _q = $zoomMeters, $isStationary)]() {
        return this[$goalSpherical].theta === this[$spherical].theta &&
            this[$goalSpherical].phi === this[$spherical].phi &&
            this[$goalSpherical].radius === this[$spherical].radius &&
            this[$goalFov] === this[$fov];
    }
    [$moveCamera]() {
        // Derive the new camera position from the updated spherical:
        this[$spherical].makeSafe();
        this[$sphericalToPosition](this[$spherical], this.camera.position);
        this.camera.lookAt(this[$target]);
        if (this.camera.fov !== this[$fov]) {
            this.camera.fov = this[$fov];
            this.camera.updateProjectionMatrix();
        }
        const source = this[$isUserChange] ? ChangeSource.USER_INTERACTION : ChangeSource.NONE;
        this.dispatchEvent({ type: 'change', source });
    }
    get [$canInteract]() {
        if (this[$options].interactionPolicy == 'allow-when-focused') {
            const rootNode = this.element.getRootNode();
            return rootNode.activeElement === this.element;
        }
        return this[$options].interactionPolicy === 'always-allow';
    }
    [$userAdjustOrbit](deltaTheta, deltaPhi, deltaRadius) {
        const handled = this.adjustOrbit(deltaTheta, deltaPhi, deltaRadius);
        this[$isUserChange] = true;
        return handled;
    }
    [$pixelLengthToSphericalAngle](pixelLength) {
        return TAU * pixelLength / this.element.clientHeight;
    }
    [$sphericalToPosition](spherical, position) {
        position.setFromSpherical(spherical);
        position.applyQuaternion(this[$upQuaternionInverse]);
        position.add(this[$target]);
    }
    [$twoTouchDistance](touchOne, touchTwo) {
        const { clientX: xOne, clientY: yOne } = touchOne;
        const { clientX: xTwo, clientY: yTwo } = touchTwo;
        const xDelta = xTwo - xOne;
        const yDelta = yTwo - yOne;
        return Math.sqrt(xDelta * xDelta + yDelta * yDelta);
    }
    [$handlePointerMove](event) {
        if (!this[$pointerIsDown] || !this[$canInteract]) {
            return;
        }
        let handled = false;
        // NOTE(cdata): We test event.type as some browsers do not have a global
        // TouchEvent contructor.
        if (TOUCH_EVENT_RE.test(event.type)) {
            const { touches } = event;
            switch (this[$touchMode]) {
                case 'zoom':
                    if (this[$lastTouches].length > 1 && touches.length > 1) {
                        const lastTouchDistance = this[$twoTouchDistance](this[$lastTouches][0], this[$lastTouches][1]);
                        const touchDistance = this[$twoTouchDistance](touches[0], touches[1]);
                        const radiusDelta = -1 * this[$zoomMeters] *
                            (touchDistance - lastTouchDistance) / 10.0;
                        handled = this[$userAdjustOrbit](0, 0, radiusDelta);
                    }
                    break;
                case 'rotate':
                    const { clientX: xOne, clientY: yOne } = this[$lastTouches][0];
                    const { clientX: xTwo, clientY: yTwo } = touches[0];
                    const deltaTheta = this[$pixelLengthToSphericalAngle](xTwo - xOne);
                    const deltaPhi = this[$pixelLengthToSphericalAngle](yTwo - yOne);
                    handled = this[$userAdjustOrbit](deltaTheta, deltaPhi, 0);
                    break;
            }
            this[$lastTouches] = touches;
        }
        else {
            const { clientX: x, clientY: y } = event;
            const deltaTheta = this[$pixelLengthToSphericalAngle](x - this[$lastPointerPosition].x);
            const deltaPhi = this[$pixelLengthToSphericalAngle](y - this[$lastPointerPosition].y);
            handled = this[$userAdjustOrbit](deltaTheta, deltaPhi, 0.0);
            this[$lastPointerPosition].set(x, y);
        }
        if ((handled || this[$options].eventHandlingBehavior === 'prevent-all') &&
            event.cancelable) {
            event.preventDefault();
        }
        ;
    }
    [$handlePointerDown](event) {
        this[$pointerIsDown] = true;
        if (TOUCH_EVENT_RE.test(event.type)) {
            const { touches } = event;
            switch (touches.length) {
                default:
                case 1:
                    this[$touchMode] = 'rotate';
                    break;
                case 2:
                    this[$touchMode] = 'zoom';
                    break;
            }
            this[$lastTouches] = touches;
        }
        else {
            const { clientX: x, clientY: y } = event;
            this[$lastPointerPosition].set(x, y);
            this.element.style.cursor = 'grabbing';
        }
    }
    [$handlePointerUp](_event) {
        this.element.style.cursor = 'grab';
        this[$pointerIsDown] = false;
    }
    [$handleWheel](event) {
        if (!this[$canInteract]) {
            return;
        }
        const deltaRadius = event.deltaY * this[$zoomMeters] / 10.0;
        if ((this[$userAdjustOrbit](0, 0, deltaRadius) ||
            this[$options].eventHandlingBehavior === 'prevent-all') &&
            event.cancelable) {
            event.preventDefault();
        }
    }
    [$handleKey](event) {
        // We track if the key is actually one we respond to, so as not to
        // accidentally clober unrelated key inputs when the <model-viewer> has
        // focus and eventHandlingBehavior is set to 'prevent-all'.
        let relevantKey = false;
        let handled = false;
        switch (event.keyCode) {
            case KeyCode.PAGE_UP:
                relevantKey = true;
                handled = this[$userAdjustOrbit](0, 0, this[$zoomMeters]);
                break;
            case KeyCode.PAGE_DOWN:
                relevantKey = true;
                handled = this[$userAdjustOrbit](0, 0, -1 * this[$zoomMeters]);
                break;
            case KeyCode.UP:
                relevantKey = true;
                handled = this[$userAdjustOrbit](0, -KEYBOARD_ORBIT_INCREMENT, 0);
                break;
            case KeyCode.DOWN:
                relevantKey = true;
                handled = this[$userAdjustOrbit](0, KEYBOARD_ORBIT_INCREMENT, 0);
                break;
            case KeyCode.LEFT:
                relevantKey = true;
                handled = this[$userAdjustOrbit](-KEYBOARD_ORBIT_INCREMENT, 0, 0);
                break;
            case KeyCode.RIGHT:
                relevantKey = true;
                handled = this[$userAdjustOrbit](KEYBOARD_ORBIT_INCREMENT, 0, 0);
                break;
        }
        if (relevantKey &&
            (handled || this[$options].eventHandlingBehavior === 'prevent-all') &&
            event.cancelable) {
            event.preventDefault();
        }
    }
}
//# sourceMappingURL=SmoothControls.js.map
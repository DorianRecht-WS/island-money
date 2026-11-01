import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE } from './face.js';
import { lerp } from './math.js';
const eye = (w, h, tilt = 0, open = 1, shape)=>({
        w,
        h,
        tilt,
        open,
        shape
    });
const pair = (w, h, tilt = 0, open = 1, shape)=>[
        eye(w, h, tilt, open, shape),
        eye(w, h, -tilt, open, shape)
    ];
export const EXPRESSIONS = [
    {
        id: 'neutre',
        gaze: {
            ...REST_GAZE
        },
        split: EYE_SPLIT,
        eyes: [
            eye(EYE_W, EYE_H),
            eye(EYE_W, EYE_H)
        ]
    },
    {
        id: 'attentif',
        gaze: {
            yaw: 4,
            pitch: 5,
            roll: -4
        },
        split: 16,
        eyes: pair(0.21, 0.44)
    },
    {
        id: 'surpris',
        gaze: {
            yaw: 3,
            pitch: -3,
            roll: 0
        },
        split: 19,
        eyes: pair(0.45, 0.47)
    },
    {
        id: 'excite',
        gaze: {
            yaw: 6,
            pitch: -14,
            roll: 0
        },
        split: 19.5,
        eyes: pair(0.4, 0.56, -10)
    },
    {
        id: 'heureux',
        gaze: {
            yaw: 5,
            pitch: 9,
            roll: 0
        },
        split: 17,
        eyes: pair(0.27, 0.17, 14)
    },
    {
        id: 'hilare',
        gaze: {
            yaw: 4,
            pitch: 14,
            roll: 0
        },
        split: 18,
        eyes: pair(0.34, 0.13, 20)
    },
    {
        id: 'colere',
        gaze: {
            yaw: 3,
            pitch: 7,
            roll: 0
        },
        split: 17,
        eyes: pair(0.34, 0.15, 30)
    },
    {
        id: 'triste',
        gaze: {
            yaw: 3,
            pitch: -13,
            roll: 0
        },
        split: 16,
        eyes: pair(0.22, 0.4, -28)
    },
    {
        id: 'effraye',
        gaze: {
            yaw: 2,
            pitch: -20,
            roll: 0
        },
        split: 20.5,
        eyes: pair(0.4, 0.6)
    },
    {
        id: 'mefiant',
        gaze: {
            yaw: 12,
            pitch: 6,
            roll: -6
        },
        split: 16,
        eyes: [
            eye(0.21, 0.4),
            eye(0.22, 0.15)
        ]
    },
    {
        id: 'confus',
        gaze: {
            yaw: -14,
            pitch: 3,
            roll: 8
        },
        split: 16.5,
        eyes: [
            eye(0.2, 0.44, -18),
            eye(0.28, 0.17, 14)
        ]
    },
    {
        id: 'curieux',
        gaze: {
            yaw: 16,
            pitch: -9,
            roll: -15
        },
        split: 16.5,
        eyes: [
            eye(0.24, 0.46, -8),
            eye(0.2, 0.38, -8)
        ]
    },
    {
        id: 'fier',
        gaze: {
            yaw: 5,
            pitch: 17,
            roll: 0
        },
        split: 17,
        eyes: pair(0.3, 0.15, 18)
    },
    {
        id: 'timide',
        gaze: {
            yaw: -19,
            pitch: -14,
            roll: -7
        },
        split: 14,
        eyes: pair(0.17, 0.3)
    },
    {
        id: 'blase',
        gaze: {
            yaw: -22,
            pitch: 2,
            roll: 0
        },
        split: 16,
        eyes: pair(0.3, 0.12)
    },
    {
        id: 'somnolent',
        gaze: {
            yaw: 6,
            pitch: -9,
            roll: -3
        },
        split: 16,
        eyes: pair(0.2, 0.42, 0, 0.42)
    },
    {
        // dead: crosses for eyes, head drooping a little
        id: 'mort',
        gaze: {
            yaw: 0,
            pitch: 8,
            roll: 0
        },
        split: 18,
        eyes: pair(0.4, 0.4, 0, 1, 'cross')
    },
    {
        // coding: the git branch symbol for both eyes
        id: 'code',
        gaze: {
            yaw: 4,
            pitch: 2,
            roll: 0
        },
        split: 22,
        eyes: [
            eye(0.56, 0.56, 0, 1, 'branch'),
            eye(0.56, 0.56, 0, 1, 'branch')
        ]
    },
    {
        // money: dollar signs for eyes
        id: 'money',
        gaze: {
            yaw: 0,
            pitch: 0,
            roll: 0
        },
        split: 20,
        eyes: pair(0.6, 0.6, 0, 1, 'dollar')
    },
    {
        // starry-eyed: Y2K sparkles
        id: 'etoiles',
        gaze: {
            yaw: 4,
            pitch: -8,
            roll: 0
        },
        split: 19,
        eyes: pair(0.42, 0.42, 0, 1, 'star')
    }
];
export const EXPRESSION_BY_ID = new Map(EXPRESSIONS.map((e)=>[
        e.id,
        e
    ]));
export const DEFAULT_EXPRESSION = 'neutre';
const lerpEyeCfg = (a, b, t)=>({
        w: lerp(a.w, b.w, t),
        h: lerp(a.h, b.h, t),
        tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t),
        open: lerp(a.open, b.open, t),
        shape: t < 0.5 ? a.shape : b.shape
    });
export function blendExpression(a, b, t) {
    return {
        id: b.id,
        gaze: {
            yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
            pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
            roll: lerp(a.gaze.roll, b.gaze.roll, t)
        },
        split: lerp(a.split, b.split, t),
        eyes: [
            lerpEyeCfg(a.eyes[0], b.eyes[0], t),
            lerpEyeCfg(a.eyes[1], b.eyes[1], t)
        ]
    };
}

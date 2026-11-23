// PROTOTYPE (#177): the 교신 문장 the owner speaks. Made by the game's own sentence builder, so the words are the grammar's.
import type { RadioBody, RadioUtterance } from '@sim';
import { radioSentence, spoken } from '@ui/radio/sentence';

const NAMES = { callsign: '까마귀', gridLetters: 'CH' };
const say = (ending: RadioUtterance['ending'], body: RadioBody): RadioUtterance => ({ speaker: 'observer', ending, ...body });
const infantry = { targetType: 'infantry', activity: 'attacking', unit: 'platoon' } as const;
const apc = { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 2 } as const;

/** One per 문형 and more where numbers are read: 한 자리씩 (좌표·방향·표적번호), 백·십 단위 (수정량), 발수, 음성 문자, 복창. */
const UTTERANCES: [id: string, u: RadioUtterance][] = [
  ['call-adjust', say('over', { kind: 'call', slots: { warning: 'adjust' } })],
  ['call-ffe', say('over', { kind: 'call', slots: { warning: 'ffe' } })],
  ['loc-grid', say('over', { kind: 'location', slots: { method: 'grid', easting: 4657, northing: 3115 } })],
  ['loc-grid-zeros', say('over', { kind: 'location', slots: { method: 'grid', easting: 4050, northing: 3009 } })],
  ['loc-polar', say('over', { kind: 'location', slots: { method: 'polar', azimuth: 620, distance: 3800 } })],
  ['loc-polar-2', say('over', { kind: 'location', slots: { method: 'polar', azimuth: 5890, distance: 2450 } })],
  ['desc-infantry', say('over', { kind: 'description', slots: { ...infantry, rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } })],
  ['desc-apc-vt-amc', say('over', { kind: 'description', slots: { ...apc, rounds: 2, fuzeRequest: 'vt', control: 'amc', dangerClose: 0 } })],
  ['desc-unknown-dc', say('over', { kind: 'description', slots: { targetType: 'unknown', rounds: 1, fuzeRequest: 'quick', control: 'ready', dangerClose: 1 } })],
  ['desc-mortar', say('over', { kind: 'description', slots: { targetType: 'mortar', activity: 'firing', unit: 'tubes', count: 3, rounds: 4, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } })],
  ['fire', say('none', { kind: 'fire' })],
  ['corr-direction', say('over', { kind: 'correction', slots: { direction: 1250, lateralDir: 'right', lateral: 120, rangeDir: 'add', range: 400, next: 'adjust' } })],
  ['corr-left-drop', say('over', { kind: 'correction', slots: { lateralDir: 'left', lateral: 50, rangeDir: 'drop', range: 200, next: 'adjust' } })],
  ['corr-add-ffe', say('over', { kind: 'correction', slots: { rangeDir: 'add', range: 100, next: 'ffe' } })],
  ['corr-right-ffe', say('over', { kind: 'correction', slots: { lateralDir: 'right', lateral: 30, next: 'ffe' } })],
  ['corr-big', say('over', { kind: 'correction', slots: { lateralDir: 'left', lateral: 250, rangeDir: 'drop', range: 1500, next: 'adjust' } })],
  ['repeat', say('over', { kind: 'repeat', slots: { targetName: 'infantry', named: 1, effect: 'neutralized', rounds: 2 } })],
  ['eom-destroyed', say('none', { kind: 'end_of_mission', slots: { targetName: 'apc', effect: 'destroyed' } })],
  ['eom-ineffective', say('none', { kind: 'end_of_mission', slots: { targetName: 'infantry', named: 0, effect: 'ineffective' } })],
  ['shift', say('over', { kind: 'shift', slots: { ...apc, targetNumber: 1002, direction: 800, lateralDir: 'left', lateral: 200, rangeDir: 'add', range: 400, rounds: 3, dangerClose: 0 } })],
  ['pos-report', say('over', { kind: 'position_report', slots: { easting: 4599, northing: 3502 } })],
  ['readback-mto', say('wait', { kind: 'mto', slots: { fuze: 'quick', rounds: 3, control: 'ready', targetNumber: 1001 } })],
  ['readback-mto-vt-amc', say('wait', { kind: 'mto', slots: { fuze: 'vt', rounds: 2, control: 'amc', targetNumber: 1012 } })],
  ['readback-shot', say('wait', { kind: 'shot' })],
  ['readback-rounds-complete', say('wait', { kind: 'rounds_complete' })],
];

export const SENTENCES = UTTERANCES.map(([id, u]) => ({ id, kind: u.kind, text: spoken(radioSentence(u, NAMES)) }));

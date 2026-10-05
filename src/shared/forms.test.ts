import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { flattenConfigPets, nextFormId } from './config';
import { buildMenuTree, type MenuBranch } from './menu';
import { pick } from './pickers';

const cfg = JSON.parse(readFileSync(new URL('../../assets/config.jsonc', import.meta.url), 'utf8'));
test('三种形态的随机、点击、事件动作池相互独立，全部素材存在', () => {
  const groups = Object.entries(cfg.forms).map(([formId, form]) => {
    const [pet] = flattenConfigPets({ main: { ...cfg, pets: [{ ...cfg.pets[0], formId }] } });
    assert.equal(pet.formId, formId);
    assert.equal(pet.animations, (form as typeof cfg.forms.original).animations);
    const names = new Set<string>();
    const visit = (v: unknown) => {
      if (typeof v === 'string' && existsSync(new URL(`../../assets/webm/${v}.webm`, import.meta.url))) names.add(v);
      else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') Object.values(v).forEach(visit);
    };
    visit(pet.animations);
    assert.equal(names.size, formId === 'original' ? 71 : 6);
    for (let i = 0; i < 100; i++) assert.ok(names.has(pick(pet.animations!.clicks, '')));
    return names;
  });
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
    assert.equal([...groups[i]].filter(n => groups[j].has(n)).length, 0);
  }
});
test('未知形态不能落入别的服装动作池', () => {
  const [pet] = flattenConfigPets({ main: { ...cfg, pets: [{ ...cfg.pets[0], formId: 'unknown' }] } });
  assert.equal(pet.formId, undefined);
  assert.equal(pet.animations, cfg.animations);
});

test('点击切换形态轮换三次回到原服装', () => {
  let id: string | undefined = 'original';
  for (const expected of ['bandage', 'star', 'original']) {
    id = nextFormId(cfg.forms, id);
    assert.equal(id, expected);
  }
  assert.equal(nextFormId(cfg.forms, 'unknown'), 'original');
  assert.equal(nextFormId(undefined, 'original'), undefined);
});

test('全部动作引用有视频，菜单覆盖每形态动作且只有原服装显示工作状态', () => {
  for (const [id, form] of Object.entries(cfg.forms)) {
    const animations = (form as typeof cfg.forms.original).animations;
    const names = [
      ...animations.idle, ...animations.turn, ...animations.drag, ...animations.clicks,
      ...animations.moves.actions.map((move: { name: string }) => move.name),
      ...animations.categories.flatMap((category: { actions: string[] }) => category.actions),
      ...Object.values(animations.events).flat(2),
    ] as string[];
    for (const name of names) assert.ok(existsSync(new URL(`../../assets/webm/${name}.webm`, import.meta.url)), name);
    const groups = (buildMenuTree(animations, id === 'original')[0] as MenuBranch).children as MenuBranch[];
    assert.equal(groups.some((group) => group.label === '工作状态'), id === 'original');
    const menuNames = groups.flatMap((group) => group.children.map((item) => item.label));
    assert.deepEqual(new Set(menuNames), new Set(names));
    for (const group of groups) assert.equal(new Set(group.children.map((item) => item.label)).size, group.children.length);
    const ordinary = groups.filter((group) => group.label !== '工作状态').flatMap((group) => group.children.map((item) => item.label));
    assert.equal(new Set(ordinary).size, ordinary.length);
  }
});

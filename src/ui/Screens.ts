import type { Sfx } from '../audio/Sfx';
import type { ClassDef } from '../game/classes/ClassKit';
import { TOTAL_WAVES } from '../game/config';
import type { Player } from '../game/Player';
import type { Upgrade } from '../game/upgrades';

export interface EndStats {
  cls: string;
  wave: number;
  kills: number;
  time: number;
  upgrades: string[];
}

/** Telas em DOM sobre o canvas: seleção de classe, cartas de upgrade, pausa e fim de jogo. */
export class Screens {
  private keyFn: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly root: HTMLElement, private readonly sfx: Sfx) {}

  hide(): void {
    this.clearKeys();
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private show(html: string): void {
    this.clearKeys();
    this.root.innerHTML = html;
    this.root.classList.remove('hidden');
  }

  private clearKeys(): void {
    if (this.keyFn) window.removeEventListener('keydown', this.keyFn);
    this.keyFn = null;
  }

  /** Liga clique e teclas 1..9 aos elementos .card (com pequena trava contra clique acidental). */
  private bindCards(onPick: (i: number) => void, guardMs: number): void {
    const cards = [...this.root.querySelectorAll<HTMLElement>('.card')];
    const ready = performance.now() + guardMs;
    let done = false;
    const choose = (i: number) => {
      if (done || !cards[i] || performance.now() < ready) return;
      done = true;
      this.sfx.unlock();
      this.sfx.play('pick');
      onPick(i);
    };
    cards.forEach((c, i) => {
      c.addEventListener('click', () => choose(i));
      c.addEventListener('mouseenter', () => this.sfx.play('hover'));
    });
    this.keyFn = (e) => {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m) choose(Number(m[1]) - 1);
    };
    window.addEventListener('keydown', this.keyFn);
  }

  classSelect(defs: ClassDef[], onPick: (def: ClassDef) => void): void {
    const cards = defs.map((d, i) => `
      <button class="card class-card" style="--c:${d.color}">
        <span class="num">${i + 1}</span>
        <div class="emblem emblem-${d.id}"></div>
        <h2>${d.name}</h2>
        <p class="role">${d.role}</p>
        <ul>${d.abilities.map((a) => `<li><b>${a.key}</b><span>${a.text}</span></li>`).join('')}</ul>
        <div class="stats"><span>VIDA ${d.hp}</span><span>VELOCIDADE ${d.speed}</span></div>
      </button>`).join('');
    this.show(`
      <div class="panel">
        <h1 class="logo">ROGUE<span>FIGHT</span></h1>
        <p class="sub">Escolha sua classe · sobreviva a ${TOTAL_WAVES} ondas</p>
        <div class="cards">${cards}</div>
        <p class="hint">WASD mover · Mouse mirar · Botão esq. atacar · Espaço dash · Botão dir. (ou E) habilidade</p>
      </div>`);
    this.bindCards((i) => onPick(defs[i]), 0);
  }

  upgrades(wave: number, list: Upgrade[], p: Player, onPick: (u: Upgrade) => void): void {
    const cards = list.map((u, i) => {
      const lvl = p.up(u.id);
      const color = u.cls ? p.def.color : '#ffe14a';
      return `
      <button class="card up-card" style="--c:${color}; animation-delay:${i * 70}ms">
        <span class="num">${i + 1}</span>
        <div class="tag">${u.cls ? p.def.name : 'Universal'}</div>
        <div class="icon">${u.icon}</div>
        <h2>${u.name}</h2>
        <p>${u.desc}</p>
        <div class="pips">${Array.from({ length: u.max }, (_, k) => `<i class="${k < lvl ? 'on' : k === lvl ? 'next' : ''}"></i>`).join('')}</div>
      </button>`;
    }).join('');
    this.show(`
      <div class="panel">
        <p class="sub ok">Onda ${wave} concluída · +20% de vida</p>
        <h1 class="heading">Escolha um aprimoramento</h1>
        <div class="cards">${cards}</div>
        <p class="hint">Clique ou pressione 1 · 2 · 3</p>
      </div>`);
    this.bindCards((i) => onPick(list[i]), 450);
  }

  pause(): void {
    this.show(`
      <div class="panel">
        <h1 class="heading">Pausado</h1>
        <p class="hint">ESC para continuar · M liga/desliga o som</p>
      </div>`);
  }

  end(victory: boolean, s: EndStats, onRestart: () => void): void {
    const mm = Math.floor(s.time / 60);
    const ss = Math.floor(s.time % 60).toString().padStart(2, '0');
    this.show(`
      <div class="panel ${victory ? 'win' : 'lose'}">
        <h1 class="logo end">${victory ? 'VITÓRIA' : 'DERROTA'}</h1>
        <p class="sub">${victory ? 'A arena foi purgada.' : `Você caiu na onda ${s.wave} de ${TOTAL_WAVES}.`}</p>
        <div class="summary">
          <div><b>${s.cls}</b><span>classe</span></div>
          <div><b>${s.wave}/${TOTAL_WAVES}</b><span>onda</span></div>
          <div><b>${s.kills}</b><span>abates</span></div>
          <div><b>${mm}:${ss}</b><span>tempo</span></div>
        </div>
        <p class="build">${s.upgrades.length ? s.upgrades.join(' · ') : 'Nenhum aprimoramento'}</p>
        <button class="card btn" style="--c:${victory ? '#3dff8f' : '#ff3b5c'}">Jogar novamente</button>
      </div>`);
    this.bindCards(() => onRestart(), 300);
  }
}

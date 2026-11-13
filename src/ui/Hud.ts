import { TAU } from '../core/math';
import { FONT, TOTAL_WAVES } from '../game/config';
import type { Player } from '../game/Player';
import type { Renderer } from '../render/Renderer';

export interface HudData {
  player: Player;
  wave: number;
  remaining: number;
  banner: number;
  flash: number;
  time: number;
  mouseX: number;
  mouseY: number;
  showCursor: boolean;
}

/** HUD em espaço de tela, desenhado no mesmo canvas depois do mundo. */
export class Hud {
  draw(r: Renderer, d: HudData): void {
    const ctx = r.ctx;
    const p = d.player;
    const W = r.w, H = r.h;
    const hpFrac = Math.max(0, p.hp / p.stats.maxHp);

    // vinheta de dano / vida baixa
    const low = hpFrac < 0.3 && !p.dead ? 0.25 + 0.15 * Math.sin(d.time * 8) : 0;
    const va = Math.max(d.flash * 0.55, low);
    if (va > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      g.addColorStop(0, 'rgba(255,0,60,0)');
      g.addColorStop(1, `rgba(255,0,60,${va})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // ---- vida ----
    const bx = 28, by = H - 54, bw = 300, bh = 20;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `800 13px ${FONT}`;
    ctx.fillStyle = p.def.color;
    ctx.fillText(p.def.name.toUpperCase(), bx, by - 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    ctx.fillStyle = '#2b0d1a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = hpFrac < 0.3 ? '#ff3b5c' : '#3dff8f';
    ctx.fillRect(bx, by, bw * hpFrac, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(bx, by, bw * hpFrac, 5);
    ctx.font = `900 14px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const hpText = `${Math.ceil(p.hp)} / ${p.stats.maxHp}`;
    ctx.strokeText(hpText, bx + bw / 2, by + 15);
    ctx.fillText(hpText, bx + bw / 2, by + 15);

    // ---- habilidades ----
    const size = 58;
    const cx = W / 2;
    this.ability(r, cx - size - 8, H - size - 26, size, p.def.dashName, 'ESPAÇO', p.dashCd, p.dashCdMax, p.def.color);
    this.ability(r, cx + 8, H - size - 26, size, p.def.secName, 'BOTÃO DIR.', p.secCd, p.secCdMax, p.def.color);

    // ---- onda ----
    ctx.textAlign = 'center';
    ctx.font = `900 20px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    const wt = `ONDA ${d.wave} / ${TOTAL_WAVES}`;
    ctx.strokeText(wt, cx, 36);
    ctx.fillText(wt, cx, 36);
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = '#b9a8ff';
    ctx.fillText(`${d.remaining} inimigo${d.remaining === 1 ? '' : 's'}`, cx, 56);

    // tempo
    ctx.textAlign = 'right';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillStyle = '#8f84b8';
    const mm = Math.floor(d.time / 60), ss = Math.floor(d.time % 60);
    ctx.fillText(`${mm}:${ss.toString().padStart(2, '0')}`, W - 28, 36);
    ctx.fillText('ESC pausa · M som', W - 28, 56);

    // ---- letreiro da onda ----
    if (d.banner > 0) {
      const a = Math.min(1, d.banner / 0.5) * Math.min(1, (2.4 - d.banner) / 0.2);
      ctx.globalAlpha = Math.max(0, a);
      ctx.textAlign = 'center';
      ctx.font = `900 76px ${FONT}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = d.wave === TOTAL_WAVES ? '#ff3b5c' : '#ffffff';
      const t = d.wave === TOTAL_WAVES ? 'ONDA FINAL' : `ONDA ${d.wave}`;
      ctx.strokeText(t, cx, H * 0.3);
      ctx.fillText(t, cx, H * 0.3);
      if (d.wave === 1) {
        ctx.font = `700 16px ${FONT}`;
        ctx.lineWidth = 4;
        const help = 'WASD mover  ·  Mouse mirar  ·  Botão esq. atacar  ·  Espaço dash  ·  Botão dir. habilidade';
        ctx.strokeText(help, cx, H * 0.3 + 40);
        ctx.fillStyle = '#d7ccff';
        ctx.fillText(help, cx, H * 0.3 + 40);
      }
      ctx.globalAlpha = 1;
    }

    // ---- mira ----
    if (d.showCursor) {
      const mx = d.mouseX, my = d.mouseY;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      this.crosshair(ctx, mx, my);
      ctx.strokeStyle = p.def.color;
      ctx.lineWidth = 2;
      this.crosshair(ctx, mx, my);
    }
  }

  private crosshair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    ctx.moveTo(x - 16, y); ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y); ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 16);
    ctx.stroke();
  }

  private ability(
    r: Renderer, x: number, y: number, s: number,
    name: string, key: string, cd: number, max: number, color: string,
  ): void {
    const ctx = r.ctx;
    const ready = cd <= 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 3, y - 3, s + 6, s + 6);
    ctx.fillStyle = ready ? color : '#221a3d';
    ctx.fillRect(x, y, s, s);
    if (!ready) {
      const f = Math.min(1, cd / max);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x, y + s * f, s, s * (1 - f));
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    ctx.font = `900 ${name.length > 6 ? 10 : 12}px ${FONT}`;
    ctx.fillStyle = ready ? '#05030a' : '#fff';
    ctx.fillText(name, x + s / 2, y + s / 2 + (ready ? 4 : -4));
    if (!ready) {
      ctx.font = `900 15px ${FONT}`;
      ctx.fillText(cd.toFixed(1), x + s / 2, y + s / 2 + 14);
    }
    ctx.font = `700 10px ${FONT}`;
    ctx.fillStyle = '#b9a8ff';
    ctx.fillText(key, x + s / 2, y + s + 16);
  }
}

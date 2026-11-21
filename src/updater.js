// Checks GitHub Releases for a newer version and offers a one-click update.
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const $ = (id) => document.getElementById(id);

// `beforeInstall` runs right before the installer starts (it closes the app),
// so pending notes can be saved first.
export async function checkForUpdate({ beforeInstall } = {}) {
  let update;
  try {
    update = await check();
  } catch (err) {
    console.warn("[updater] falha ao verificar atualização:", err);
    return;
  }
  if (!update) return;

  const bar = $("update-bar");
  const text = $("update-text");
  const btn = $("update-btn");
  const later = $("update-later");

  text.textContent = `Nova versão ${update.version} disponível`;
  bar.hidden = false;
  requestAnimationFrame(() => bar.classList.add("show"));

  later.onclick = () => {
    bar.classList.remove("show");
    setTimeout(() => (bar.hidden = true), 250);
  };

  btn.onclick = async () => {
    btn.disabled = true;
    later.hidden = true;
    let total = 0;
    let done = 0;
    text.textContent = "Baixando atualização…";
    try {
      await beforeInstall?.();
      await update.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        if (ev.event === "Progress" && total) {
          done += ev.data.chunkLength;
          text.textContent = `Baixando atualização… ${Math.min(99, Math.round((done / total) * 100))}%`;
        }
        if (ev.event === "Finished") text.textContent = "Instalando…";
      });
      // On Windows the installer closes the app before this point.
      await relaunch();
    } catch (err) {
      console.error("[updater] falha ao atualizar:", err);
      text.textContent = "Não foi possível atualizar. Tente mais tarde.";
      btn.disabled = false;
      later.hidden = false;
    }
  };
}

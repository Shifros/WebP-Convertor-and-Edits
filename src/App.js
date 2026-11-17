import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import ImageEditor from "./ImageEditor";
import site from "./site.json";
import { segment, useAnimatedClose, useBackdropClose, withViewTransition } from "./motion";
import {
  MAX_FILES,
  MAX_BYTES,
  MAX_PIXELS,
  MAX_SIDE,
  effective,
  formatBytes,
  loadImage,
  exportImage,
  makeThumb,
  getOutputDimensions,
  uniqueFilename,
  download,
  extension,
} from "./image-tools";

const defaults = {
  format: "webp",
  quality: 85,
  resize: false,
  width: "",
  height: "",
  locked: true,
  upscale: false,
  suffix: "",
};
/** Batch settings from a link, e.g. ?format=webp&quality=80&width=1200 */
const readPresets = () => {
  const settings = { ...defaults };
  try {
    const params = new URLSearchParams(window.location.search);
    const format = (params.get("format") || "").toLowerCase();
    const map = { webp: "webp", jpg: "jpeg", jpeg: "jpeg", png: "png" };
    if (map[format]) settings.format = map[format];
    const quality = Math.round(Number(params.get("quality")));
    if (quality >= 1 && quality <= 100) settings.quality = quality;
    const side = (key) => {
      const value = Math.round(Number(params.get(key)));
      return value >= 1 && value <= MAX_SIDE ? String(value) : "";
    };
    settings.width = side("width");
    settings.height = side("height");
    settings.resize = !!(settings.width || settings.height);
    const suffix = params.get("suffix");
    if (suffix) settings.suffix = suffix.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").slice(0, 40);
  } catch {}
  return settings;
};

export const AGENT_SNIPPET = `await ShifrosImageStudio.convert(input, {
  format: "webp",          // webp | jpg | png
  quality: 80,             // 1-100
  width: 800, height: 600,
  fit: "cover",            // cover | contain | fill
});
// input: File | Blob | CORS URL | data: URL

await ShifrosImageStudio.convertAll([a, b], { format: "webp" });  // ZIP`;

function AgentGuide({ onClose: done }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const onClose = useAnimatedClose(ref, done);
  const backdrop = useBackdropClose(ref, () => onClose());
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(AGENT_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  return (
    <dialog
      ref={ref}
      className="help agent-guide"
      aria-labelledby="agent-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      {...backdrop}
    >
      <header className="dialog-head">
        <div>
          <span className="eyebrow">AI agents</span>
          <h2 id="agent-title">Agent usage</h2>
        </div>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <ul className="agent-rules">
        <li>
          <strong>No server. No HTTP API.</strong> Files stay on the device.
        </li>
        <li>
          <strong>Can execute code:</strong> process locally with sharp (Node)
          or Pillow (Python).
        </li>
        <li>
          <strong>Browser only:</strong> run in this page:
        </li>
      </ul>
      <div className="agent-code">
        <pre>
          <code>{AGENT_SNIPPET}</code>
        </pre>
        <button className="text-button" onClick={copy}>
          <Icon name={copied ? "check" : "file"} size={14} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="help-note">
        <Icon name="file" size={16} />
        <span>
          Spec: <a href="/llms.txt" target="_blank" rel="noreferrer">/llms.txt</a>.
          Presets: <code>?format=webp&amp;quality=80&amp;width=1200</code>
        </span>
      </p>
    </dialog>
  );
}

function Mascot() {
  return (
    <svg className="mascot" viewBox="0 0 120 120" aria-hidden="true">
      <ellipse className="shadow" cx="60" cy="108" rx="26" ry="4" fill="currentColor" opacity=".14" />
      <g className="bob">
        <rect x="40" y="94" width="11" height="10" rx="4" fill="currentColor" />
        <rect x="69" y="94" width="11" height="10" rx="4" fill="currentColor" />
        <rect x="20" y="18" width="80" height="80" rx="16" fill="#00D68F" />
        <clipPath id="mascot-screen">
          <rect x="29" y="27" width="62" height="62" rx="9" />
        </clipPath>
        <g clipPath="url(#mascot-screen)">
          <rect x="29" y="27" width="62" height="62" fill="#E8FFF4" />
          <path d="M29 80 48 63l11 10 10-8 22 17v7H29Z" fill="#00A870" />
          <circle cx="79" cy="39" r="5" fill="#C6F135" />
        </g>
        <g className="blink">
          <circle cx="49" cy="49" r="4.2" fill="#0B0B0F" />
          <circle cx="71" cy="49" r="4.2" fill="#0B0B0F" />
        </g>
        <circle cx="42" cy="58" r="3.4" fill="#FF9DB8" opacity=".7" />
        <circle cx="78" cy="58" r="3.4" fill="#FF9DB8" opacity=".7" />
        <path d="M55 57q5 5 10 0" fill="none" stroke="#0B0B0F" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Faq({ onClose: done }) {
  const ref = useRef(null);
  const onClose = useAnimatedClose(ref, done);
  const backdrop = useBackdropClose(ref, () => onClose());
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="help faq-dialog"
      aria-labelledby="faq-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      {...backdrop}
    >
      <header className="dialog-head">
        <div>
          <span className="eyebrow">FAQ</span>
          <h2 id="faq-title">Common questions</h2>
        </div>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="faq-list">
        {site.faq.map((item) => (
          <details key={item.q}>
            <summary>
              {item.q}
              <Icon name="chevron" size={16} />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </dialog>
  );
}

const ACCEPT =".jpg,.jpeg,.png,.webp,.gif,.svg,.bmp,.avif";
const isImage = (file) =>
  /\.(jpe?g|png|webp|gif|svg|bmp|avif)$/i.test(file.name);
const THEMES = ["system", "light", "dark"];
const getThemePreference = () => {
  try {
    const saved = localStorage.getItem("shifros-theme-preference");
    return THEMES.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
};

function Help({ onClose: done }) {
  const ref = useRef(null);
  const onClose = useAnimatedClose(ref, done);
  const backdrop = useBackdropClose(ref, () => onClose());
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="help"
      aria-labelledby="help-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      {...backdrop}
    >
      <header className="dialog-head">
        <div>
          <span className="eyebrow">How it works</span>
          <h2 id="help-title">From image to ready.</h2>
        </div>
        <button className="icon-button" aria-label="Close help" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <ol className="help-steps">
        <li>
          <strong>Add images.</strong>
          <p>
            Drop up to 20 files, choose them, or paste from your clipboard.
            Each can be up to 50 MB.
          </p>
        </li>
        <li>
          <strong>Set the batch.</strong>
          <p>Pick a format, quality and an optional maximum size for everything.</p>
        </li>
        <li>
          <strong>Fine-tune any image.</strong>
          <p>
            Press Edit on a card to give that image its own format, quality,
            exact size, crop area, rotation and flip. Type 500 × 600 and the
            crop box takes that shape. Move it to choose the area.
          </p>
        </li>
        <li>
          <strong>Download.</strong>
          <p>
            Download one image from its card, or everything as a ZIP.
          </p>
        </li>
      </ol>
      <p className="help-note">
        <Icon name="shield" size={16} />
        Images never leave your device. Animated images export as a still
        frame, and JPG uses a white background for transparency.
      </p>
    </dialog>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(readPresets);
  const [themePreference, setThemePreference] = useState(getThemePreference);
  const [systemTheme, setSystemTheme] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  const theme = themePreference === "system" ? systemTheme : themePreference;
  const [view, setView] = useState("grid");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editId, setEditId] = useState(null);
  const [help, setHelp] = useState(false);
  const [agentGuide, setAgentGuide] = useState(false);
  const [faq, setFaq] = useState(false);
  const input = useRef(null);
  const urls = useRef(new Set());
  const itemsRef = useRef(items);
  const settingsRef = useRef(settings);
  const busyRef = useRef(false);
  const dragDepth = useRef(0);
  itemsRef.current = items;
  settingsRef.current = settings;

  const remember = (url) => {
    urls.current.add(url);
    return url;
  };
  const release = (url) => {
    if (url) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
    }
  };
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(preference.matches ? "dark" : "light");
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.__mesh?.(theme);
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem("shifros-theme-preference", themePreference);
    } catch {}
  }, [themePreference]);
  useEffect(() => {
    if (!notice || notice.type === "error") return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const addFiles = useCallback(async (files) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setNotice(null);
    const accepted = [];
    const errors = [];
    let count = itemsRef.current.length;
    for (const file of Array.from(files)) {
      if (count >= MAX_FILES) {
        errors.push(
          `The workspace holds up to ${MAX_FILES} images. Remove a few to add more.`,
        );
        break;
      }
      if (!isImage(file)) {
        errors.push(`${file.name}: choose JPG, PNG, WebP, GIF, SVG, BMP or AVIF.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name} exceeds the 50 MB limit.`);
        continue;
      }
      if (
        itemsRef.current
          .concat(accepted)
          .some(
            (item) =>
              item.name === file.name &&
              item.size === file.size &&
              item.modified === file.lastModified,
          )
      )
        continue;
      const url = remember(URL.createObjectURL(file));
      try {
        const decoded = await loadImage(url);
        const { naturalWidth: w, naturalHeight: h } = decoded;
        if (!w || !h || w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS)
          throw new Error(
            "Image exceeds the 64 megapixel or 16,384 pixel per-side limit.",
          );
        accepted.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          modified: file.lastModified,
          url,
          thumb: null,
          width: w,
          height: h,
          rotation: 0,
          flipped: false,
          crop: null,
          out: null,
          format: null,
          quality: null,
          result: null,
          error: null,
        });
        count++;
      } catch (error) {
        release(url);
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    setItems((current) => [...current, ...accepted]);
    if (errors.length)
      setNotice({ type: "error", text: [...new Set(errors)].join(" ") });
    setLoading(false);
    busyRef.current = false;
  }, []);

  useEffect(() => {
    const hasFiles = (e) => e.dataTransfer?.types.includes("Files");
    const over = (e) => hasFiles(e) && e.preventDefault();
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current++;
      setDragging(true);
    };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      dragDepth.current--;
      if (dragDepth.current <= 0) {
        dragDepth.current = 0;
        setDragging(false);
      }
    };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (!document.querySelector("dialog[open]")) addFiles(e.dataTransfer.files);
    };
    const paste = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    const key = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "o" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        if (!busyRef.current) input.current.click();
      }
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
      window.removeEventListener("keydown", key);
    };
  }, [addFiles]);

  const clearResults = (list) => {
    list.forEach((item) => release(item.result?.url));
    return list.map((item) => ({ ...item, result: null, error: null }));
  };
  const updateSettings = (patch) => {
    setSettings((current) => ({ ...current, ...patch }));
    setItems(clearResults);
    setNotice(null);
  };
  const [leaving, setLeaving] = useState(() => new Set());
  const remove = (id) => {
    setLeaving((current) => new Set(current).add(id));
    setTimeout(() => {
      setLeaving((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      removeNow(id);
    }, 220);
  };
  const removeNow = (id) =>
    setItems((current) =>
      current.filter((item) => {
        if (item.id !== id) return true;
        release(item.url);
        release(item.thumb);
        release(item.result?.url);
        return false;
      }),
    );
  const clear = () => {
    setLeaving(new Set(items.map((item) => item.id)));
    setTimeout(clearNow, 220);
  };
  const clearNow = () => {
    setLeaving(new Set());
    itemsRef.current.forEach((item) => {
      release(item.url);
      release(item.thumb);
      release(item.result?.url);
    });
    setItems([]);
    setNotice(null);
  };

  const results = items.filter((item) => item.result);
  const pending = items.filter((item) => !item.result);
  const inputBytes = items.reduce((total, item) => total + item.size, 0);
  const originalBytes = results.reduce((total, item) => total + item.size, 0);
  const outputBytes = results.reduce(
    (total, item) => total + item.result.blob.size,
    0,
  );
  const savings = originalBytes
    ? Math.round((1 - outputBytes / originalBytes) * 100)
    : 0;
  const sizeInvalid =
    settings.resize &&
    [settings.width, settings.height].some(
      (value) =>
        value !== "" &&
        (!Number.isInteger(Number(value)) ||
          Number(value) < 1 ||
          Number(value) > MAX_SIDE),
    );
  const busy = working !== null || loading;

  const storeResult = (id, result) => {
    remember(result.url);
    setItems((current) =>
      current.map((value) => {
        if (value.id !== id) return value;
        release(value.result?.url);
        return { ...value, result, error: null };
      }),
    );
  };
  const storeError = (id, error) =>
    setItems((current) =>
      current.map((value) =>
        value.id === id ? { ...value, error: error.message } : value,
      ),
    );

  /** Export the given images that have no result yet. Returns every result. */
  const exportMany = async (list, label) => {
    const done = new Map(list.filter((i) => i.result).map((i) => [i.id, i.result]));
    const todo = list.filter((i) => !i.result);
    for (let index = 0; index < todo.length; index++) {
      setWorking({ label, index: index + 1, total: todo.length });
      try {
        const result = await exportImage(todo[index], settingsRef.current);
        storeResult(todo[index].id, result);
        done.set(todo[index].id, result);
      } catch (error) {
        storeError(todo[index].id, error);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return done;
  };

  const downloadOne = async (item) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setNotice(null);
    try {
      const done = await exportMany([item], "Preparing");
      const result = done.get(item.id);
      if (result) download(result.url, result.filename);
      else
        setNotice({
          type: "error",
          text: `${item.name} could not be exported. Check the message on its card.`,
        });
    } finally {
      setWorking(null);
      busyRef.current = false;
    }
  };

  const downloadAll = async () => {
    if (busyRef.current || !items.length || sizeInvalid) return;
    busyRef.current = true;
    setNotice(null);
    try {
      const done = await exportMany(itemsRef.current, "Exporting");
      const ready = itemsRef.current.filter((item) => done.has(item.id));
      if (ready.length === 1) {
        const result = done.get(ready[0].id);
        download(result.url, result.filename);
      } else if (ready.length > 1) {
        setWorking({ label: "Zipping", index: 0, total: 0 });
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        const used = new Set();
        ready.forEach((item) => {
          const result = done.get(item.id);
          zip.file(uniqueFilename(result.filename, used), result.blob);
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = remember(URL.createObjectURL(blob));
        download(url, "shifros-images.zip");
        setTimeout(() => release(url), 10000);
      }
      const failed = itemsRef.current.length - ready.length;
      setNotice(
        failed
          ? {
              type: "error",
              text: `${failed} image${failed === 1 ? "" : "s"} could not be exported. Check the message on ${failed === 1 ? "its" : "their"} card.`,
            }
          : {
              type: "success",
              text: ready.length === 1 ? "Your image is ready." : `${ready.length} images saved as a ZIP.`,
            },
      );
    } catch {
      setNotice({
        type: "error",
        text: "Could not create the ZIP. You can still download each image from its card.",
      });
    } finally {
      setWorking(null);
      busyRef.current = false;
    }
  };

  const saveEdit = async (id, patch, andDownload) => {
    const current = itemsRef.current.find((item) => item.id === id);
    const merged = { ...current, ...patch, result: null, error: null };
    let thumb = null;
    try {
      thumb = remember(await makeThumb(merged));
    } catch {}
    release(current.thumb);
    release(current.result?.url);
    setItems((list) =>
      list.map((item) => (item.id === id ? { ...merged, thumb } : item)),
    );
    setEditId(null);
    if (andDownload) await downloadOne({ ...merged, thumb });
  };

  const editing = items.find((item) => item.id === editId);
  const empty = !items.length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <a
            className="brand"
            href="https://shifros.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Shifros home"
          >
            <img src="/icons/icon.svg" alt="Shifros" width="1024" height="1024" />
          </a>
          <span className="header-divider" />
          <div className="tool-name">
            <div className="tool-title">
              <h1>Image Studio</h1>
              <span className="tool-badge">TOOL 01</span>
            </div>
            <small>BY SHIFROS</small>
          </div>
          <div className="header-actions">
            <span className="local-status">
              <i /> All on your device
            </span>
            <button
              className="agent-chip"
              aria-label="Guide for AI agents"
              title="Guide for AI agents"
              onClick={() => setAgentGuide(true)}
            >
              AI agent?
            </button>
            <button
              className="icon-button"
              aria-label="How it works"
              title="How it works"
              onClick={() => setHelp(true)}
            >
              <Icon name="help" size={18} />
            </button>
            <div
              className="theme-toggle"
              role="group"
              aria-label="Color theme"
              style={segment(theme === "dark" ? 1 : 0, 2)}
            >
              {[
                ["light", "sun", "Light theme"],
                ["dark", "moon", "Dark theme"],
              ].map(([value, icon, label]) => (
                <button
                  key={value}
                  className={theme === value ? "selected" : ""}
                  aria-pressed={theme === value}
                  aria-label={label}
                  title={label}
                  onClick={() =>
                    theme !== value &&
                    withViewTransition(() => setThemePreference(value))
                  }
                >
                  <Icon name={icon} size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="brand-mesh" aria-hidden="true" />
        <div className="hero-inner">
          <div>
            <span className="eyebrow">
              <i /> Convert &amp; edit
            </span>
            <h2>
              A little edit. A lighter image<b>.</b>
            </h2>
          </div>
          <button
            className="button secondary"
            disabled={busy || items.length >= MAX_FILES}
            onClick={() => input.current.click()}
          >
            <Icon name="plus" size={16} />
            Add images
          </button>
        </div>
      </section>

      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept={ACCEPT}
        multiple
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
        aria-label="Choose images"
        tabIndex={-1}
      />

      <main className="studio">
        <section className="panel workspace" aria-labelledby="workspace-title">
          <div className="panel-head">
            <h3 id="workspace-title">
              Images <span className="count">{items.length}</span>
            </h3>
            {!empty && (
              <div className="panel-tools">
                <button className="text-button" onClick={clear} disabled={busy}>
                  Clear all
                </button>
                <div
                  className="segmented small"
                  role="group"
                  aria-label="Layout"
                  style={segment(view === "grid" ? 0 : 1, 2)}
                >
                  <button
                    className={view === "grid" ? "selected" : ""}
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                    onClick={() => setView("grid")}
                  >
                    <Icon name="grid" size={14} />
                  </button>
                  <button
                    className={view === "list" ? "selected" : ""}
                    aria-label="List view"
                    aria-pressed={view === "list"}
                    onClick={() => setView("list")}
                  >
                    <Icon name="list" size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
          {empty ? (
            <div className={`dropzone ${dragging ? "dragging" : ""}`}>
              <Mascot />
              <h4>{loading ? "Opening your images…" : "Good images start here."}</h4>
              <p>Drop images here, or choose them from your device.</p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => input.current.click()}
              >
                <Icon name="upload" size={16} />
                Choose images
              </button>
              <small>or paste from your clipboard</small>
            </div>
          ) : (
            <div className={`queue ${view}`} key={view} aria-live="polite">
              {items.map((item, index) => {
                const dim = getOutputDimensions(item, settings);
                const eff = effective(item, settings);
                const custom =
                  item.crop ||
                  item.out ||
                  item.rotation ||
                  item.flipped ||
                  item.format ||
                  item.quality != null;
                const fmt = extension(eff.format).toUpperCase();
                const changed =
                  dim.width !== item.width || dim.height !== item.height;
                return (
                  <article
                    className={`card ${item.result ? "done" : ""} ${leaving.has(item.id) ? "leaving" : ""}`}
                    key={item.id}
                    style={{ "--d": `${Math.min(index, 12) * 40}ms` }}
                  >
                    <button
                      className="thumb checker"
                      onClick={() => setEditId(item.id)}
                      disabled={busy}
                      aria-label={`Edit ${item.name}`}
                    >
                      <img src={item.thumb || item.url} alt="" />
                      {custom && <span className="tag">Edited</span>}
                      {item.result && (
                        <span className="tag ready">
                          <Icon name="check" size={11} />
                        </span>
                      )}
                    </button>
                    <div className="card-body">
                      <h4 title={item.name}>{item.name}</h4>
                      <p>
                        {item.result ? (
                          <>
                            {item.result.width} × {item.result.height} ·{" "}
                            {extension(item.result.format).toUpperCase()} ·{" "}
                            {formatBytes(item.result.blob.size)}
                          </>
                        ) : (
                          <>
                            {changed
                              ? `${item.width} × ${item.height} → ${dim.width} × ${dim.height}`
                              : `${item.width} × ${item.height}`}{" "}
                            · {fmt}
                            {eff.format !== "png" && ` ${eff.quality}%`}
                          </>
                        )}
                      </p>
                      {item.error && (
                        <p className="card-error" role="alert">
                          {item.error}
                        </p>
                      )}
                    </div>
                    <div className="card-actions">
                      <button
                        className="button ghost small"
                        disabled={busy}
                        onClick={() => setEditId(item.id)}
                      >
                        <Icon name="edit" size={14} />
                        Edit
                      </button>
                      <button
                        className="icon-button small"
                        aria-label={`Download ${item.name}`}
                        title="Download this image"
                        disabled={busy || sizeInvalid}
                        onClick={() => downloadOne(item)}
                      >
                        <Icon name="download" size={15} />
                      </button>
                      <button
                        className="icon-button small danger"
                        aria-label={`Remove ${item.name}`}
                        title="Remove"
                        disabled={busy}
                        onClick={() => remove(item.id)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
              <button
                className="add-tile"
                disabled={busy || items.length >= MAX_FILES}
                onClick={() => input.current.click()}
              >
                <Icon name="plus" size={20} />
                <span>{loading ? "Opening…" : "Add more"}</span>
              </button>
            </div>
          )}
          <div className="panel-foot">
            <span>JPG, PNG, WebP, GIF, SVG, BMP, AVIF</span>
            <span>Up to {MAX_FILES} images · 50 MB each</span>
          </div>
        </section>

        <aside className="panel settings" aria-labelledby="settings-title">
          <div className="panel-head">
            <h3 id="settings-title">Batch settings</h3>
            <button
              className="icon-button small"
              aria-label="Reset batch settings"
              title="Reset"
              disabled={busy}
              onClick={() => updateSettings(defaults)}
            >
              <Icon name="reset" size={14} />
            </button>
          </div>
          <fieldset disabled={busy} className="settings-body">
            <div className="field">
              <div className="field-top">
                <span className="field-label">Format</span>
              </div>
              <div
                className="segmented"
                role="group"
                aria-label="Output format"
                style={segment(["webp", "jpeg", "png"].indexOf(settings.format), 3)}
              >
                {[
                  ["webp", "WebP"],
                  ["jpeg", "JPG"],
                  ["png", "PNG"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={settings.format === value ? "selected" : ""}
                    aria-pressed={settings.format === value}
                    onClick={() => updateSettings({ format: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="field-top">
                <label className="field-label" htmlFor="quality">
                  Quality
                </label>
                <span className="pill">
                  {settings.format === "png" ? "Lossless" : `${settings.quality}%`}
                </span>
              </div>
              <input
                id="quality"
                className="slider"
                type="range"
                min="10"
                max="100"
                value={settings.quality}
                disabled={settings.format === "png"}
                style={{ "--fill": `${((settings.quality - 10) / 90) * 100}%` }}
                onChange={(e) => updateSettings({ quality: Number(e.target.value) })}
              />
              <div className="presets">
                {[
                  ["Compact", 65],
                  ["Balanced", 85],
                  ["Best", 100],
                ].map(([label, value]) => (
                  <button
                    key={label}
                    className={
                      settings.quality === value && settings.format !== "png"
                        ? "selected"
                        : ""
                    }
                    disabled={settings.format === "png"}
                    onClick={() => updateSettings({ quality: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="field-top">
                <label className="field-label" htmlFor="resize">
                  Limit size
                </label>
                <input
                  id="resize"
                  type="checkbox"
                  role="switch"
                  className="toggle"
                  checked={settings.resize}
                  onChange={(e) => updateSettings({ resize: e.target.checked })}
                />
              </div>
              <div
                className={`collapse ${settings.resize ? "open" : ""}`}
                aria-hidden={!settings.resize}
              >
                <div className="collapse-inner">
                  <div className="size-row">
                    <label className="size-field">
                      <span>Max width</span>
                      <div>
                        <input
                          inputMode="numeric"
                          placeholder="Auto"
                          value={settings.width}
                          onChange={(e) =>
                            updateSettings({
                              width: e.target.value.replace(/\D/g, "").slice(0, 5),
                            })
                          }
                        />
                        <i>px</i>
                      </div>
                    </label>
                    <button
                      className={`icon-button link-toggle ${settings.locked ? "on" : ""}`}
                      aria-pressed={settings.locked}
                      aria-label="Keep proportions"
                      title={settings.locked ? "Keeps proportions" : "May stretch"}
                      onClick={() => updateSettings({ locked: !settings.locked })}
                    >
                      <Icon name="link" size={16} />
                    </button>
                    <label className="size-field">
                      <span>Max height</span>
                      <div>
                        <input
                          inputMode="numeric"
                          placeholder="Auto"
                          value={settings.height}
                          onChange={(e) =>
                            updateSettings({
                              height: e.target.value.replace(/\D/g, "").slice(0, 5),
                            })
                          }
                        />
                        <i>px</i>
                      </div>
                    </label>
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={settings.upscale}
                      onChange={(e) => updateSettings({ upscale: e.target.checked })}
                    />
                    Allow enlargement
                  </label>
                  {sizeInvalid && (
                    <p className="card-error" role="alert">
                      Enter whole numbers from 1 to 16,384.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="field">
              <div className="field-top">
                <label className="field-label" htmlFor="suffix">
                  Filename suffix
                </label>
                <span className="optional">Optional</span>
              </div>
              <input
                className="text-input"
                id="suffix"
                placeholder="e.g. -optimized"
                maxLength={40}
                value={settings.suffix}
                onChange={(e) =>
                  updateSettings({
                    suffix: e.target.value.replace(/[\\/:*?"<>|\x00-\x1f]/g, ""),
                  })
                }
              />
            </div>
          </fieldset>
          <div className="export">
            <div className="export-stats">
              {results.length > 0 ? (
                <>
                  <span>
                    {formatBytes(originalBytes)} → {formatBytes(outputBytes)}
                  </span>
                  <span className={savings > 0 ? "good" : ""}>
                    {savings > 0
                      ? `${savings}% lighter`
                      : savings < 0
                        ? `${Math.abs(savings)}% larger`
                        : "Same size"}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {items.length
                      ? `${items.length} image${items.length === 1 ? "" : "s"}`
                      : "No images yet"}
                  </span>
                  <span>{items.length ? formatBytes(inputBytes) : ""}</span>
                </>
              )}
            </div>
            <button
              className={`button primary block ${working ? "working" : ""}`}
              style={{
                "--p": working?.total
                  ? `${(working.index / working.total) * 100}%`
                  : "100%",
              }}
              disabled={!items.length || busy || sizeInvalid}
              onClick={downloadAll}
            >
              {working ? (
                <>
                  <span className="spinner" />
                  {working.total
                    ? `${working.label} ${working.index}/${working.total}`
                    : `${working.label}…`}
                </>
              ) : (
                <>
                  <Icon name="download" size={16} />
                  {items.length > 1
                    ? `Download all ${items.length}`
                    : "Download image"}
                  <em>{items.length > 1 ? ".zip" : `.${extension(settings.format)}`}</em>
                </>
              )}
            </button>
            <p className="export-note">
              Edit any image to give it its own settings.
            </p>
          </div>
        </aside>
      </main>

      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <a
              href="https://shifros.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Shifros Studio home"
            >
              <img src="/brand/shifros-studio-reversed.svg" alt="Shifros Studio" />
            </a>
            <span className="footer-brand-rule" />
            <span>
              Thoughtfully made.
              <br />
              <strong>For the everyday.</strong>
            </span>
          </div>
          <div className="footer-actions">
            <button onClick={() => setHelp(true)}>
              How it works
              <Icon name="arrow" size={14} />
            </button>
            <button onClick={() => setFaq(true)}>
              FAQ
              <Icon name="arrow" size={14} />
            </button>
            <a href="https://shifros.com" target="_blank" rel="noreferrer">
              shifros.com
              <Icon name="external" size={13} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            Image Studio <span className="footer-dot">/</span> A tool by Shifros
          </span>
          <span className="footer-shortcut">
            <kbd>Ctrl</kbd> + <kbd>O</kbd> to add images
          </span>
          <span className="footer-local">
            <i /> On your device. Always.
          </span>
        </div>
      </footer>

      {notice && (
        <div
          className={`toast ${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          <Icon name={notice.type === "error" ? "help" : "check"} size={16} />
          <span>{notice.text}</span>
          <button
            className="icon-button small"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div>
            <Icon name="upload" size={32} />
            <h2>Drop your images.</h2>
            <p>We’ll take it from here.</p>
          </div>
        </div>
      )}
      {editing && (
        <ImageEditor
          key={editing.id}
          image={editing}
          batch={settings}
          onClose={() => setEditId(null)}
          onSave={(patch, andDownload) => saveEdit(editing.id, patch, andDownload)}
        />
      )}
      {help && <Help onClose={() => setHelp(false)} />}
      {faq && <Faq onClose={() => setFaq(false)} />}
      {agentGuide && <AgentGuide onClose={() => setAgentGuide(false)} />}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import Icon from "./Icon";
import { segment, useAnimatedClose, useBackdropClose } from "./motion";
import {
  MAX_PIXELS,
  MAX_SIDE,
  formatBytes,
  makeStage,
  transformedSize,
} from "./image-tools";

const PRESETS = [
  ["Free", null],
  ["Original", "original"],
  ["1:1", 1],
  ["4:3", 4 / 3],
  ["3:2", 3 / 2],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
];
const FORMAT_LABELS = [
  ["webp", "WebP"],
  ["jpeg", "JPG"],
  ["png", "PNG"],
];
const same = (a, b) => a != null && b != null && Math.abs(a - b) < 0.001;
const digits = (value) => value.replace(/\D/g, "").slice(0, 5);

/** A centred crop box (in %) of the given ratio, scaled to `scale` of the largest fit. */
function fitCrop(ratio, width, height, scale = 1) {
  const r = ratio || width / height;
  const boxWidth = Math.min(width, height * r) * scale;
  const boxHeight = boxWidth / r;
  const w = (boxWidth / width) * 100;
  const h = (boxHeight / height) * 100;
  return { unit: "%", x: (100 - w) / 2, y: (100 - h) / 2, width: w, height: h };
}

export default function ImageEditor({ image, batch, onSave, onClose: done }) {
  const dialog = useRef(null);
  const onClose = useAnimatedClose(dialog, done);
  const backdrop = useBackdropClose(dialog, () => onClose());
  const [glide, setGlide] = useState(false);
  const glideTimer = useRef(null);
  // Let the crop box ease into a new shape instead of jumping.
  const animateCrop = (next) => {
    clearTimeout(glideTimer.current);
    setGlide(true);
    setCrop(next);
    glideTimer.current = setTimeout(() => setGlide(false), 420);
  };
  const [rotation, setRotation] = useState(image.rotation);
  const [flipped, setFlipped] = useState(image.flipped);
  const { width: tw, height: th } = transformedSize({
    ...image,
    rotation,
  });
  const [stage, setStage] = useState({ url: image.url, own: false });
  const [crop, setCrop] = useState(() => {
    const full = transformedSize(image);
    const c = image.crop;
    return c
      ? {
          unit: "%",
          x: (c.x / full.width) * 100,
          y: (c.y / full.height) * 100,
          width: (c.width / full.width) * 100,
          height: (c.height / full.height) * 100,
        }
      : fitCrop(null, full.width, full.height);
  });
  const [fixed, setFixed] = useState(!!image.out);
  const [ratio, setRatio] = useState(
    image.out ? image.out.width / image.out.height : null,
  );
  const [outW, setOutW] = useState(image.out ? String(image.out.width) : "");
  const [outH, setOutH] = useState(image.out ? String(image.out.height) : "");
  const [link, setLink] = useState(false);
  const [format, setFormat] = useState(image.format || batch.format);
  const [quality, setQuality] = useState(image.quality ?? batch.quality);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => {
      previous?.focus();
      if (stageRef.current.own) URL.revokeObjectURL(stageRef.current.url);
    };
  }, []);

  // Rebuild the stage image whenever the picture is rotated or flipped.
  useEffect(() => {
    if (first.current && !rotation && !flipped) return;
    let cancelled = false;
    if (!rotation && !flipped) {
      setStage((old) => {
        if (old.own) URL.revokeObjectURL(old.url);
        return { url: image.url, own: false };
      });
      return;
    }
    makeStage({ ...image, rotation, flipped }).then((url) => {
      if (cancelled) return URL.revokeObjectURL(url);
      setStage((old) => {
        if (old.own) URL.revokeObjectURL(old.url);
        return { url, own: true };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [rotation, flipped]);

  const pixels = useMemo(() => {
    const x = Math.max(0, Math.round((crop.x / 100) * tw));
    const y = Math.max(0, Math.round((crop.y / 100) * th));
    return {
      x: Math.min(x, tw - 1),
      y: Math.min(y, th - 1),
      width: Math.max(1, Math.min(tw - x, Math.round((crop.width / 100) * tw))),
      height: Math.max(
        1,
        Math.min(th - y, Math.round((crop.height / 100) * th)),
      ),
    };
  }, [crop, tw, th]);

  const shownW = fixed ? outW : String(pixels.width);
  const shownH = fixed ? outH : String(pixels.height);
  const targetW = Number(shownW) || 0;
  const targetH = Number(shownH) || 0;
  const sizeError =
    fixed &&
    (!targetW ||
      !targetH ||
      targetW > MAX_SIDE ||
      targetH > MAX_SIDE ||
      targetW * targetH > MAX_PIXELS)
      ? "Enter sizes from 1 to 16,384 px."
      : "";
  const enlarged = fixed && targetW > pixels.width && !sizeError;

  // Typing a size reshapes the crop box to that exact ratio.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!fixed) return;
    const w = Number(outW);
    const h = Number(outH);
    if (!w || !h) return;
    const timer = setTimeout(() => {
      const r = w / h;
      if (same(r, ratio)) return;
      setRatio(r);
      animateCrop(fitCrop(r, tw, th, 0.9));
    }, 350);
    return () => clearTimeout(timer);
  }, [outW, outH, fixed]);

  const preset = (value) => {
    const r = value === "original" ? tw / th : value;
    setFixed(false);
    setRatio(r);
    animateCrop(
      fitCrop(r, tw, th, value === null || value === "original" ? 1 : 0.9),
    );
  };
  const editSize = (axis, raw) => {
    const value = digits(raw);
    let w = axis === "w" ? value : shownW;
    let h = axis === "h" ? value : shownH;
    if (link && Number(shownW) && Number(shownH) && value) {
      const aspect = Number(shownW) / Number(shownH);
      if (axis === "w") h = String(Math.max(1, Math.round(Number(value) / aspect)));
      else w = String(Math.max(1, Math.round(Number(value) * aspect)));
    }
    setFixed(true);
    setOutW(w);
    setOutH(h);
  };
  const turn = (step) => {
    const next = (rotation + step + 360) % 360;
    const size = transformedSize({ ...image, rotation: next });
    setRotation(next);
    setCrop(fitCrop(ratio, size.width, size.height, ratio ? 0.9 : 1));
  };
  const flip = () => {
    setFlipped(!flipped);
    animateCrop(fitCrop(ratio, tw, th, ratio ? 0.9 : 1));
  };
  const reset = () => {
    setRotation(0);
    setFlipped(false);
    setFixed(false);
    setRatio(null);
    setOutW("");
    setOutH("");
    setFormat(batch.format);
    setQuality(batch.quality);
    const size = transformedSize({ ...image, rotation: 0 });
    animateCrop(fitCrop(null, size.width, size.height));
  };

  const save = async (andDownload) => {
    if (sizeError || busy) return;
    let area = pixels;
    if (fixed) {
      // Derive the height from the width so the box matches the target ratio exactly.
      const height = Math.min(
        th,
        Math.max(1, Math.round((pixels.width * targetH) / targetW)),
      );
      area = {
        ...pixels,
        height,
        y: Math.min(pixels.y, th - height),
      };
    }
    const whole =
      area.x === 0 && area.y === 0 && area.width === tw && area.height === th;
    setBusy(true);
    const patch = [
      {
        rotation,
        flipped,
        crop: whole ? null : area,
        out: fixed ? { width: targetW, height: targetH } : null,
        format: format === batch.format ? null : format,
        quality:
          quality === batch.quality || format === "png" ? null : quality,
      },
      andDownload,
    ];
    onClose(() => onSave(...patch));
  };

  const dirty = rotation || flipped || fixed || crop.width < 99.9 || crop.height < 99.9;

  return (
    <dialog
      className="editor"
      ref={dialog}
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      {...backdrop}
    >
      <header className="editor-head">
        <div className="editor-title">
          <h2 id="editor-title" title={image.name}>
            {image.name}
          </h2>
          <p>
            {image.width} × {image.height} px · {formatBytes(image.size)}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Close editor"
          onClick={() => onClose()}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="editor-body">
        <div className={`editor-stage checker ${glide ? "glide" : ""}`}>
          <ReactCrop
            crop={crop}
            onChange={(_, percent) => setCrop(percent)}
            aspect={ratio || undefined}
            minWidth={8}
            minHeight={8}
            ruleOfThirds
            keepSelection
          >
            <img
              key={stage.url}
              className="stage-image"
              src={stage.url}
              alt="Drag the box to choose the area to keep"
            />
          </ReactCrop>
        </div>
        <div className="editor-controls">
          <section className="control-group">
            <div className="control-label">
              <span>Crop &amp; size</span>
              <small>
                {pixels.width} × {pixels.height} px selected
              </small>
            </div>
            <div className="chips" role="group" aria-label="Crop shape">
              {PRESETS.map(([label, value]) => {
                const active =
                  !fixed &&
                  (value === null
                    ? ratio === null
                    : same(ratio, value === "original" ? tw / th : value));
                return (
                  <button
                    key={label}
                    className={`chip ${active ? "selected" : ""}`}
                    aria-pressed={active}
                    onClick={() => preset(value)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="size-row">
              <label className="size-field">
                <span>Width</span>
                <div>
                  <input
                    inputMode="numeric"
                    value={shownW}
                    onChange={(e) => editSize("w", e.target.value)}
                    aria-label="Output width in pixels"
                  />
                  <i>px</i>
                </div>
              </label>
              <button
                className={`icon-button link-toggle ${link ? "on" : ""}`}
                aria-pressed={link}
                aria-label="Keep proportions when typing a size"
                title={link ? "Proportions linked" : "Proportions free"}
                onClick={() => setLink(!link)}
              >
                <Icon name="link" size={16} />
              </button>
              <label className="size-field">
                <span>Height</span>
                <div>
                  <input
                    inputMode="numeric"
                    value={shownH}
                    onChange={(e) => editSize("h", e.target.value)}
                    aria-label="Output height in pixels"
                  />
                  <i>px</i>
                </div>
              </label>
            </div>
            <p className={`control-hint ${sizeError ? "error" : ""}`}>
              {sizeError ||
                (fixed
                  ? `Exports at exactly ${targetW} × ${targetH} px.${enlarged ? " This enlarges the selection." : ""}`
                  : "Type a size to crop to it, or drag the box freely.")}
            </p>
          </section>
          <section className="control-group">
            <div className="control-label">
              <span>Format</span>
            </div>
            <div
              className="segmented"
              role="group"
              aria-label="Output format"
              style={segment(FORMAT_LABELS.findIndex(([v]) => v === format), 3)}
            >
              {FORMAT_LABELS.map(([value, label]) => (
                <button
                  key={value}
                  className={format === value ? "selected" : ""}
                  aria-pressed={format === value}
                  onClick={() => setFormat(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="control-label slider-label">
              <label htmlFor="editor-quality">Quality</label>
              <span className="pill">
                {format === "png" ? "Lossless" : `${quality}%`}
              </span>
            </div>
            <input
              id="editor-quality"
              className="slider"
              type="range"
              min="10"
              max="100"
              value={quality}
              disabled={format === "png"}
              style={{ "--fill": `${((quality - 10) / 90) * 100}%` }}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
            <p className="control-hint">
              {format === batch.format && quality === batch.quality
                ? "Matches your batch settings."
                : "Only this image uses these settings."}
            </p>
          </section>
          <section className="control-group">
            <div className="control-label">
              <span>Orientation</span>
            </div>
            <div className="tool-row">
              <button className="button ghost" onClick={() => turn(-90)}>
                <Icon name="rotate" size={16} style={{ transform: "scaleX(-1)" }} />
                Left
              </button>
              <button className="button ghost" onClick={() => turn(90)}>
                <Icon name="rotate" size={16} />
                Right
              </button>
              <button
                className={`button ghost ${flipped ? "on" : ""}`}
                onClick={flip}
              >
                <Icon name="flip" size={16} />
                Flip
              </button>
            </div>
          </section>
        </div>
      </div>
      <footer className="editor-foot">
        <button className="text-button" onClick={reset} disabled={!dirty && !image.format && image.quality == null}>
          <Icon name="reset" size={14} />
          Reset
        </button>
        <div className="foot-actions">
          <button className="button ghost" onClick={() => onClose()}>
            Cancel
          </button>
          <button
            className="button secondary"
            disabled={!!sizeError || busy}
            onClick={() => save(false)}
          >
            Save
          </button>
          <button
            className="button primary"
            disabled={!!sizeError || busy}
            onClick={() => save(true)}
          >
            <Icon name="download" size={16} />
            Save &amp; download
          </button>
        </div>
      </footer>
    </dialog>
  );
}

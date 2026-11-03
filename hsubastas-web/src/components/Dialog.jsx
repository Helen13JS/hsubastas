import React, { useEffect, useRef } from "react";
function Dialog({ title, titleId = "modal-title", onClose, children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => {
      if (node.open) node.close();
    };
  }, []);
  return <dialog ref={ref} className={className} aria-labelledby={titleId} onCancel={(event) => {
    event.preventDefault();
    onClose();
  }}>
    <button className="dialog-close" type="button" aria-label="Cerrar ventana" onClick={onClose}>×</button>
    <h2 id={titleId}>{title}</h2>{children}
  </dialog>;
}
export {
  Dialog as default
};

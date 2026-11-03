import React, { useEffect, useRef } from "react";
import { attachSpecifications } from "../modules/auctions/specifications.js";
function SpecificationsLink({ auction }) {
  const ref = useRef(null);
  useEffect(() => attachSpecifications(ref.current, auction), [auction]);
  return <a ref={ref} className="spec-download" href="#" download="Descargar_Especificaciones_Tecnicas.pdf">📄 Descargar_Especificaciones_Tecnicas.pdf</a>;
}
export {
  SpecificationsLink as default
};

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import ObjectiveModal from "./ObjectiveModal";
import { useRouter } from "next/navigation";

export default function AddObjectiveButton() {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn-press inline-block bg-gold hover:bg-gold/90 text-dark-bg font-semibold py-3 px-8 rounded-lg transition-colors"
      >
        Add Your First Objective
      </button>

      {showModal && createPortal(
        <ObjectiveModal
          date={null}
          objective={null}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            router.refresh();
          }}
        />,
        document.body
      )}
    </>
  );
}

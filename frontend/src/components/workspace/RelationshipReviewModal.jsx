import React, { useState, useEffect } from 'react';
import {
  Link2,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Database,
  ArrowRight,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import Modal from '../common/Modal';
import Chip from '../common/Chip';

export default function RelationshipReviewModal({
  isOpen,
  onClose,
  onConfirm,
  onChooseDifferentFiles,
  reviewData,
  isConfirming = false,
}) {
  const [relationships, setRelationships] = useState([]);
  const [leftTable, setLeftTable] = useState('');
  const [leftCol, setLeftCol] = useState('');
  const [rightTable, setRightTable] = useState('');
  const [rightCol, setRightCol] = useState('');
  const [addError, setAddError] = useState(null);

  // Sync state when reviewData opens
  useEffect(() => {
    if (reviewData) {
      setRelationships(reviewData.relationships || []);
      const tables = reviewData.tables || [];
      if (tables.length >= 2) {
        setLeftTable(tables[0]);
        setRightTable(tables[1]);
      } else if (tables.length === 1) {
        setLeftTable(tables[0]);
        setRightTable(tables[0]);
      }
      setAddError(null);
    }
  }, [reviewData]);

  // Update column options when tables change
  const tableColumns = reviewData?.tableColumns || {};
  const leftColumns = tableColumns[leftTable] || [];
  const rightColumns = tableColumns[rightTable] || [];

  useEffect(() => {
    if (leftColumns.length > 0 && (!leftCol || !leftColumns.includes(leftCol))) {
      setLeftCol(leftColumns[0]);
    }
  }, [leftTable, leftColumns, leftCol]);

  useEffect(() => {
    if (rightColumns.length > 0 && (!rightCol || !rightColumns.includes(rightCol))) {
      setRightCol(rightColumns[0]);
    }
  }, [rightTable, rightColumns, rightCol]);

  const handleRemoveRelationship = (index) => {
    setRelationships((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddRelationship = (e) => {
    e.preventDefault();
    setAddError(null);

    if (!leftTable || !leftCol || !rightTable || !rightCol) {
      setAddError('Please select both tables and columns.');
      return;
    }

    if (leftTable === rightTable && leftCol === rightCol) {
      setAddError('Cannot link a column to itself on the same table.');
      return;
    }

    // Check duplicate
    const exists = relationships.some(
      (r) =>
        (r.left_table === leftTable &&
          r.left_column === leftCol &&
          r.right_table === rightTable &&
          r.right_column === rightCol) ||
        (r.left_table === rightTable &&
          r.left_column === rightCol &&
          r.right_table === leftTable &&
          r.right_column === leftCol)
    );

    if (exists) {
      setAddError('This relationship already exists.');
      return;
    }

    const newRel = {
      left_table: leftTable,
      left_column: leftCol,
      right_table: rightTable,
      right_column: rightCol,
      cardinality: 'many_to_one',
      overlap_pct: 1.0,
      confidence: 1.0,
      is_manual: true,
    };

    setRelationships((prev) => [...prev, newRel]);
  };

  const handleConfirm = () => {
    if (relationships.length === 0 || isConfirming) return;
    onConfirm(relationships);
  };

  if (!isOpen || !reviewData) return null;

  const isUnlinkedError = reviewData.unlinkedError;
  const tables = reviewData.tables || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={isConfirming ? () => {} : onClose}
      title={isUnlinkedError ? 'Link Your Datasets' : 'Review Detected Relationships'}
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col gap-5">
        {/* Banner */}
        {isUnlinkedError ? (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>No Common Field Auto-Detected</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              These datasets do not share matching column names with overlapping values. Select the common key column between them below to link them together, or choose different files.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-violet-950/30 border border-violet-800/40 text-slate-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              We analyzed your tables and discovered the following candidate join keys. Confirm or modify them before launching your workspace.
            </div>
          </div>
        )}

        {/* Available Tables and Columns Reference (especially useful in 422 state) */}
        {isUnlinkedError && tables.length > 0 && (
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#070b14] border border-[#162035]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Available Columns by Table
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-1">
              {tables.map((tbl) => (
                <div key={tbl} className="flex flex-col gap-1.5 p-2 rounded-lg bg-[#0d1322] border border-[#1a253d]">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                    <Database className="w-3.5 h-3.5 text-violet-400" />
                    <span>{tbl}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(tableColumns[tbl] || []).map((col) => (
                      <span
                        key={col}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detected Relationships List */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
            <span className="font-semibold text-slate-200">
              Active Relationships ({relationships.length})
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {relationships.length === 0 ? 'At least 1 link required' : 'Ready to query'}
            </span>
          </div>

          {relationships.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-[#1a243a] text-center text-xs text-slate-500 bg-[#070b14]/50">
              No relationships defined yet. Use the selector below to link two tables.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {relationships.map((rel, idx) => {
                const card = (rel.cardinality || 'link').replace(/_/g, ' ');
                const pct =
                  rel.overlap_pct !== undefined
                    ? `${Math.round(rel.overlap_pct * 100)}% match`
                    : null;

                return (
                  <div
                    key={`${rel.left_table}-${rel.left_column}-${rel.right_table}-${rel.right_column}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#090e1b] border border-[#1a253d] hover:border-violet-600/40 transition gap-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-cyan-300 font-semibold bg-cyan-950/40 px-2 py-1 rounded border border-cyan-800/40">
                        <span>{rel.left_table}</span>
                        <span className="text-slate-500">.</span>
                        <span className="text-cyan-200">{rel.left_column}</span>
                      </div>

                      <div className="flex items-center gap-1 px-1 text-slate-500">
                        <Link2 className="w-3.5 h-3.5 text-violet-400" />
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-xs text-cyan-300 font-semibold bg-cyan-950/40 px-2 py-1 rounded border border-cyan-800/40">
                        <span>{rel.right_table}</span>
                        <span className="text-slate-500">.</span>
                        <span className="text-cyan-200">{rel.right_column}</span>
                      </div>

                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-800/40">
                        {card}
                      </span>

                      {pct && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                          {pct}
                        </span>
                      )}

                      {rel.is_manual && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          manual
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRelationship(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition shrink-0"
                      title="Remove relationship"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Manual Relationship Section */}
        <div className="p-3.5 rounded-xl bg-[#070b14] border border-[#162035] flex flex-col gap-3">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Manual Relationship</span>
          </span>

          {addError && (
            <p className="text-[11px] font-mono text-rose-400 px-1">{addError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Left Pair */}
            <div className="flex items-center gap-2">
              <select
                value={leftTable}
                onChange={(e) => setLeftTable(e.target.value)}
                className="w-1/2 p-2 rounded-lg bg-[#0d1322] border border-[#1e2a44] text-slate-200 text-xs font-mono focus:outline-none focus:border-violet-500"
              >
                {tables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={leftCol}
                onChange={(e) => setLeftCol(e.target.value)}
                className="w-1/2 p-2 rounded-lg bg-[#0d1322] border border-[#1e2a44] text-slate-200 text-xs font-mono focus:outline-none focus:border-violet-500"
              >
                {leftColumns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Right Pair */}
            <div className="flex items-center gap-2">
              <select
                value={rightTable}
                onChange={(e) => setRightTable(e.target.value)}
                className="w-1/2 p-2 rounded-lg bg-[#0d1322] border border-[#1e2a44] text-slate-200 text-xs font-mono focus:outline-none focus:border-violet-500"
              >
                {tables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={rightCol}
                onChange={(e) => setRightCol(e.target.value)}
                className="w-1/2 p-2 rounded-lg bg-[#0d1322] border border-[#1e2a44] text-slate-200 text-xs font-mono focus:outline-none focus:border-violet-500"
              >
                {rightColumns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleAddRelationship}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link Columns</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1a243a]">
          <button
            type="button"
            onClick={onChooseDifferentFiles}
            disabled={isConfirming}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition disabled:opacity-50"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Choose Different Files</span>
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={relationships.length === 0 || isConfirming}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-violet-950/60 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {isConfirming ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Activating Workspace...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Open Workspace</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}


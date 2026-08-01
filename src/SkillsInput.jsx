import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { KNOWN_SKILLS, normalizeSkillText, isKnownSkill, looksLikePersonName } from '../lib/matching';
import { inputCls, btn3D } from '../lib/styles';

export function SkillsInput({ skills, onChange, dark, currentUser }) {
  const [draft, setDraft] = useState('');
  const [skillError, setSkillError] = useState('');

  const addSkill = () => {
    const val = draft.trim();
    setSkillError('');
    if (!val) return;
    if (val.length < 2 || val.length > 30) {
      setSkillError('Skill should be 2–30 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9+#./\- ]*$/.test(val)) {
      setSkillError("That doesn't look like a valid skill.");
      return;
    }
    if (looksLikePersonName(val, currentUser)) {
      setSkillError('That looks like a name, not a skill — add things like "Java" or "Content Writing" instead.');
      return;
    }
    if (!isKnownSkill(val)) {
      setSkillError('We don\u2019t recognize that as a skill yet. Try a specific skill, tool or competency (e.g. "Excel", "Tally", "Digital Marketing").');
      return;
    }
    if (skills.some((s) => s.toLowerCase() === val.toLowerCase())) { setDraft(''); return; }
    onChange([...skills, val]);
    setDraft('');
  };
  const removeSkill = (val) => onChange(skills.filter((s) => s !== val));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
        {skills.length === 0 && <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>No skills added yet — add a few below.</span>}
        {skills.map((s) => (
          <span key={s} className={`flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full border ${dark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {s}
            <button type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`} className="hover:opacity-70 transition-transform active:scale-75">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      {skillError && <p className={`text-xs mb-2 ${dark ? 'text-red-400' : 'text-red-600'}`}>{skillError}</p>}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setSkillError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          placeholder="e.g. Java — press Enter or tap Add"
          list="cb-known-skills"
          className={inputCls(dark)}
        />
        <datalist id="cb-known-skills">
          {KNOWN_SKILLS.map((s) => <option key={s} value={s} />)}
        </datalist>
        <button type="button" onClick={addSkill} className={`h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 flex items-center gap-1 shrink-0 ${btn3D(dark)}`}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}


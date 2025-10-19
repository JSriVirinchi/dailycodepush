const LANGUAGES = [
  'python',
  'cpp',
  'java',
  'javascript',
  'typescript',
  'c',
  'csharp',
  'go',
  'rust',
  'kotlin',
  'swift'
] as const;

type LanguagePickerProps = {
  value: string;
  onChange: (language: string) => void;
};

const LanguagePicker = ({ value, onChange }: LanguagePickerProps) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <label htmlFor="language-picker" className="block text-sm font-semibold text-slate-900">
      Preferred language
    </label>
    <p className="mt-1 text-xs text-slate-500">Choose a language to filter community solutions.</p>
    <div className="mt-4">
      <select
        id="language-picker"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {language}
          </option>
        ))}
      </select>
    </div>
  </section>
);

export default LanguagePicker;

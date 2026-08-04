import { ArrowDown, ArrowUp, Eye, Mail, Plus, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  createTemplate,
  deleteTemplate,
  fetchMergeFields,
  fetchTemplates,
  previewTemplate,
  sendTestEmail,
  updateTemplate,
} from "../api/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  FormField,
  Input,
  Modal,
  PageContainer,
  PageHeader,
  SampleBadge,
  Select,
  Textarea,
} from "../components/ui";
import type { EmailBlock, EmailTemplate, MergeField } from "../types";

const BLOCK_TYPES: { type: EmailBlock["type"]; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Paragraph" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
  { type: "footer", label: "Footer" },
];

function newBlock(type: EmailBlock["type"]): EmailBlock {
  switch (type) {
    case "heading":
      return { type, text: "Hi {{first_name}},", level: 2 };
    case "text":
      return { type, html: "Write your message here…" };
    case "button":
      return { type, text: "Book a call", url: "https://" };
    case "divider":
      return { type };
    case "spacer":
      return { type, height: 24 };
    case "footer":
      return { type, text: "Sent by {{sender_name}} at {{business_name}}. Reply STOP to opt out." };
  }
}

export default function EmailBuilder() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [mergeFields, setMergeFields] = useState<MergeField[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showTest, setShowTest] = useState(false);

  const load = useCallback(() => {
    fetchTemplates().then((list) => {
      setTemplates(list);
      if (list.length > 0 && selectedId === null) select(list[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    fetchMergeFields().then(setMergeFields).catch(() => undefined);
  }, [load]);

  function select(template: EmailTemplate) {
    setSelectedId(template.id);
    setName(template.name);
    setSubject(template.subject);
    setBlocks(template.blocks);
    setDirty(false);
    setError(null);
  }

  function startNew() {
    setSelectedId(null);
    setName("New template");
    setSubject("Quick question about {{company_name}}");
    setBlocks([newBlock("heading"), newBlock("text"), newBlock("footer")]);
    setDirty(true);
  }

  function mutate(updater: (blocks: EmailBlock[]) => EmailBlock[]) {
    setBlocks((prev) => updater(prev));
    setDirty(true);
  }

  function updateBlock(index: number, patch: Partial<EmailBlock>) {
    mutate((prev) => prev.map((b, i) => (i === index ? ({ ...b, ...patch } as EmailBlock) : b)));
  }

  function move(index: number, delta: number) {
    mutate((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save(): Promise<number | null> {
    setSaving(true);
    setError(null);
    try {
      const payload = { name, subject, blocks };
      const saved = selectedId === null ? await createTemplate(payload) : await updateTemplate(selectedId, payload);
      setSelectedId(saved.id);
      setDirty(false);
      fetchTemplates().then(setTemplates);
      setNotice("Template saved.");
      setTimeout(() => setNotice(null), 2500);
      return saved.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    const id = dirty || selectedId === null ? await save() : selectedId;
    if (id === null) return;
    const result = await previewTemplate(id);
    setPreviewHtml(result.html);
  }

  async function remove() {
    if (selectedId === null || !window.confirm("Delete this template?")) return;
    try {
      await deleteTemplate(selectedId);
      setSelectedId(null);
      setName("");
      setSubject("");
      setBlocks([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const editorOpen = selectedId !== null || dirty;

  return (
    <PageContainer>
      <PageHeader
        icon={Mail}
        title="Email Builder"
        subtitle="Build reusable templates from simple blocks, personalise them with merge fields, preview with sample data and send yourself a test."
        actions={
          <Button onClick={startNew}>
            <Plus size={15} /> New template
          </Button>
        }
      />
      <ErrorNote message={error} />
      {notice && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}

      <div className="grid gap-4 xl:grid-cols-4">
        {/* Template list */}
        <Card className="p-3 xl:col-span-1">
          <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">Templates</p>
          <ul className="space-y-1">
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    selectedId === template.id ? "bg-brand-50 font-semibold text-brand-800" : "text-ink-700 hover:bg-ink-50"
                  }`}
                  onClick={() => select(template)}
                >
                  <span className="truncate">{template.name}</span>
                  <SampleBadge show={template.is_sample} />
                </button>
              </li>
            ))}
            {templates.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-400">No templates yet.</p>}
          </ul>
        </Card>

        {/* Editor */}
        <div className="space-y-4 xl:col-span-2">
          {!editorOpen ? (
            <EmptyState icon={Mail} title="Select a template or create a new one" />
          ) : (
            <>
              <Card className="space-y-3 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Template name">
                    <Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
                  </FormField>
                  <FormField label="Subject line">
                    <Input value={subject} onChange={(e) => { setSubject(e.target.value); setDirty(true); }} />
                  </FormField>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button loading={saving} onClick={save}>Save</Button>
                  <Button variant="secondary" onClick={preview}>
                    <Eye size={15} /> Preview
                  </Button>
                  <Button variant="secondary" disabled={selectedId === null} onClick={() => setShowTest(true)}>
                    <Send size={15} /> Send test
                  </Button>
                  {selectedId !== null && (
                    <Button variant="ghost" className="!text-danger-600" onClick={remove}>
                      <Trash2 size={15} /> Delete
                    </Button>
                  )}
                </div>
              </Card>

              <div className="space-y-2.5">
                {blocks.map((block, index) => (
                  <Card key={index} className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge tone="gray">{BLOCK_TYPES.find((b) => b.type === block.type)?.label ?? block.type}</Badge>
                      <div className="flex gap-1">
                        <IconBtn onClick={() => move(index, -1)}><ArrowUp size={14} /></IconBtn>
                        <IconBtn onClick={() => move(index, 1)}><ArrowDown size={14} /></IconBtn>
                        <IconBtn danger onClick={() => mutate((prev) => prev.filter((_, i) => i !== index))}><Trash2 size={14} /></IconBtn>
                      </div>
                    </div>

                    {block.type === "heading" && (
                      <div className="flex gap-2">
                        <Input value={block.text ?? ""} onChange={(e) => updateBlock(index, { text: e.target.value })} />
                        <Select className="!w-24" value={block.level ?? 2} onChange={(e) => updateBlock(index, { level: Number(e.target.value) })}>
                          <option value={1}>H1</option>
                          <option value={2}>H2</option>
                          <option value={3}>H3</option>
                        </Select>
                      </div>
                    )}
                    {block.type === "text" && (
                      <Textarea rows={3} value={block.html ?? ""} onChange={(e) => updateBlock(index, { html: e.target.value })} />
                    )}
                    {block.type === "button" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={block.text ?? ""} onChange={(e) => updateBlock(index, { text: e.target.value })} placeholder="Button label" />
                        <Input value={block.url ?? ""} onChange={(e) => updateBlock(index, { url: e.target.value })} placeholder="https://…" />
                      </div>
                    )}
                    {block.type === "spacer" && (
                      <div className="flex items-center gap-2 text-sm text-ink-500">
                        Height
                        <Input type="number" className="!w-24" min={4} max={120} value={block.height ?? 24} onChange={(e) => updateBlock(index, { height: Number(e.target.value) || 24 })} />
                        px
                      </div>
                    )}
                    {block.type === "footer" && (
                      <Textarea rows={2} value={block.text ?? ""} onChange={(e) => updateBlock(index, { text: e.target.value })} />
                    )}
                    {block.type === "divider" && <div className="border-t border-dashed border-ink-300" />}
                  </Card>
                ))}
              </div>

              <Card className="flex flex-wrap gap-2 p-3">
                {BLOCK_TYPES.map(({ type, label }) => (
                  <Button key={type} size="sm" variant="secondary" onClick={() => mutate((prev) => [...prev, newBlock(type)])}>
                    <Plus size={13} /> {label}
                  </Button>
                ))}
              </Card>
            </>
          )}
        </div>

        {/* Merge fields */}
        <Card className="h-fit p-4 xl:col-span-1">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">Merge fields</p>
          <p className="mb-3 text-xs text-ink-500">Copy a token into any text — it's replaced per lead when sending.</p>
          <ul className="space-y-1.5">
            {mergeFields.map((field) => (
              <li key={field.token}>
                <button
                  className="w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-left transition hover:border-brand-400 hover:bg-brand-50"
                  onClick={() => {
                    navigator.clipboard?.writeText(field.token).catch(() => undefined);
                    setNotice(`${field.token} copied to clipboard.`);
                    setTimeout(() => setNotice(null), 2000);
                  }}
                >
                  <code className="text-xs font-semibold text-brand-700">{field.token}</code>
                  <p className="text-[11px] text-ink-400">{field.label}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {previewHtml && (
        <Modal title={`Preview — ${subject || name}`} onClose={() => setPreviewHtml(null)} wide>
          <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className="h-[60vh] w-full rounded-xl border border-ink-200 bg-ink-50" />
        </Modal>
      )}

      {showTest && selectedId !== null && (
        <SendTestModal
          templateId={selectedId}
          onClose={() => setShowTest(false)}
          onResult={(msg) => {
            setNotice(msg);
            setTimeout(() => setNotice(null), 5000);
          }}
        />
      )}
    </PageContainer>
  );
}

function IconBtn({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      className={`rounded-lg p-1.5 transition ${danger ? "text-ink-400 hover:bg-danger-50 hover:text-danger-600" : "text-ink-400 hover:bg-ink-100 hover:text-ink-700"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SendTestModal({ templateId, onClose, onResult }: { templateId: number; onClose: () => void; onResult: (msg: string) => void }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const result = await sendTestEmail(templateId, email);
      onResult(`Test send via ${result.sender}: ${result.status}. ${result.detail}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      setSending(false);
    }
  }

  return (
    <Modal title="Send a test email" onClose={onClose}>
      <ErrorNote message={error} />
      <p className="mb-3 text-sm text-ink-500">
        Sample values fill the merge fields. In demo mode the send is simulated; configure SMTP in the backend .env to send for real.
      </p>
      <FormField label="Send to">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourdomain.com" autoFocus />
      </FormField>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={sending} disabled={!email.includes("@")} onClick={send}>Send test</Button>
      </div>
    </Modal>
  );
}

import { useEffect, useState } from 'react'
import { useAgent } from '../../../modules/agent/store'
import type { DshClient } from '../../../dsh-client/client'
import { useT } from '../../../hooks'

type Providers = Awaited<ReturnType<DshClient['llmProviders']>>['providers']
type Groups = Awaited<ReturnType<DshClient['llmModels']>>['groups']
type CredView = Record<string, { configured: boolean; source?: string; writable: boolean }>

const COMMON_REFS = ['DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'MOONSHOT_API_KEY', 'KIMI_API_KEY']
const PROTOCOLS = [
  { id: 'openai-completions', label: 'OpenAI Completions' },
  { id: 'openai-responses', label: 'OpenAI Responses' },
  { id: 'anthropic-messages', label: 'Anthropic Messages' },
]

function CredRow({ refName, view, onChanged }: { refName: string; view?: CredView[string]; onChanged(): void }) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const client = useAgent((state) => state.client)
  const save = async (): Promise<void> => {
    if (!draft.trim()) return
    setBusy(true)
    try {
      await client.credentialsSet(refName, draft.trim())
      setDraft('')
      onChanged()
    } finally { setBusy(false) }
  }
  const unset = async (): Promise<void> => {
    setBusy(true)
    try {
      await client.credentialsUnset(refName)
      onChanged()
    } finally { setBusy(false) }
  }
  return (
    <div className="cred-row">
      <code className="cred-name">{refName}</code>
      <span className={`pill ${view?.configured ? 'cred-ok' : ''}`}>
        {view?.configured ? `${t('setCredConfigured')}${view.source ? ` · ${view.source}` : ''}` : t('setCredEmpty')}
      </span>
      <input
        className="input cred-input" type="password" placeholder={t('setCredPlaceholder')}
        value={draft} onChange={(event) => setDraft(event.target.value)}
      />
      <button className="btn" disabled={busy || !draft.trim()} onClick={() => void save()}>{t('save')}</button>
      {view?.configured && view.writable && (
        <button className="btn btn-danger" disabled={busy} onClick={() => void unset()}>{t('setCredUnset')}</button>
      )}
    </div>
  )
}

const slugToEnv = (slug: string): string => `${slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`

/** 添加第三方供应商：写凭据 + settings 用户层，直接生效于 dsh。 */
function ProviderForm({ onDone }: { onDone(message: string): void }) {
  const t = useT()
  const client = useAgent((state) => state.client)
  const [slug, setSlug] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [api, setApi] = useState(PROTOCOLS[0].id)
  const [baseURL, setBaseURL] = useState('')
  const [apiKeyEnv, setApiKeyEnv] = useState('')
  const [envTouched, setEnvTouched] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [modelsText, setModelsText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugOk = /^[a-z][a-z0-9-]*$/.test(slug)
  const urlOk = /^https?:\/\/\S+$/.test(baseURL)
  const ready = slugOk && urlOk && apiKeyEnv.trim().length > 0 && apiKey.trim().length > 0

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const env = apiKeyEnv.trim()
      await client.credentialsSet(env, apiKey.trim())
      const models = modelsText.split(/[,，\s]+/).map((id) => id.trim()).filter((id) => id.length > 0)
        .map((id) => ({ id }))
      await client.settingsUpdate('llm-pi-ai', {
        providers: {
          [slug]: {
            displayName: displayName.trim() || slug,
            api,
            baseURL: baseURL.trim(),
            apiKeyEnv: env,
            models,
            defaultContextWindow: 262144,
            defaultMaxTokens: 32768,
          },
        },
      })
      onDone(t('setProviderAdded', { name: displayName.trim() || slug }))
      setSlug(''); setDisplayName(''); setBaseURL(''); setApiKey(''); setModelsText(''); setEnvTouched(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="provider-form">
      <div className="provider-form-row">
        <label>{t('setProviderId')}</label>
        <input
          className="input" placeholder="my-provider" value={slug}
          onChange={(event) => {
            setSlug(event.target.value)
            if (!envTouched) setApiKeyEnv(slugToEnv(event.target.value))
          }}
        />
        {slug.length > 0 && !slugOk && <span className="form-error">{t('setProviderIdBad')}</span>}
      </div>
      <div className="provider-form-row">
        <label>{t('setProviderName')}</label>
        <input className="input" placeholder={t('setProviderNamePh')} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </div>
      <div className="provider-form-row">
        <label>{t('setProviderApi')}</label>
        <select className="input" value={api} onChange={(event) => setApi(event.target.value)}>
          {PROTOCOLS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="provider-form-row">
        <label>baseURL</label>
        <input className="input" placeholder="https://api.example.com/v1" value={baseURL} onChange={(event) => setBaseURL(event.target.value)} />
        {baseURL.length > 0 && !urlOk && <span className="form-error">{t('setProviderUrlBad')}</span>}
      </div>
      <div className="provider-form-row">
        <label>{t('setProviderEnv')}</label>
        <input
          className="input" placeholder="MY_PROVIDER_API_KEY" value={apiKeyEnv}
          onChange={(event) => { setApiKeyEnv(event.target.value); setEnvTouched(true) }}
        />
      </div>
      <div className="provider-form-row">
        <label>API Key</label>
        <input className="input" type="password" placeholder={t('setCredPlaceholder')} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
      </div>
      <div className="provider-form-row">
        <label>{t('setProviderModels')}</label>
        <input className="input" placeholder={t('setProviderModelsPh')} value={modelsText} onChange={(event) => setModelsText(event.target.value)} />
      </div>
      {error && <div className="conn-banner conn-banner-error">{error}</div>}
      <div className="provider-form-actions">
        <button className="btn btn-primary" disabled={!ready || busy} onClick={() => void submit()}>
          {busy ? t('checking') : t('setProviderAdd')}
        </button>
      </div>
    </div>
  )
}

/** 模型设置：第三方供应商配置（直写 dsh）+ 提供商/模型目录/凭据。 */
export function ModelSettings() {
  const t = useT()
  const client = useAgent((state) => state.client)
  const connection = useAgent((state) => state.connection)
  const [providers, setProviders] = useState<Providers>([])
  const [groups, setGroups] = useState<Groups>([])
  const [creds, setCreds] = useState<CredView>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const refresh = (): void => {
    void client.llmProviders().then((result) => setProviders(result.providers)).catch((e) => setError(String(e)))
    void client.llmModels().then((result) => setGroups(result.groups)).catch(() => undefined)
  }
  const refreshCreds = (): void => {
    void client.credentialsDescribe(COMMON_REFS)
      .then((result) => setCreds(result.credentials))
      .catch(() => undefined)
  }

  useEffect(() => {
    if (connection !== 'ready') return
    refresh()
    refreshCreds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection])

  if (connection !== 'ready') {
    return <div className="text-dim text-xs py-2">{t('setNeedKernel')}</div>
  }

  const thirdParty = providers.filter((p) => p.settingsNs === 'llm-pi-ai' && p.declared)

  const removeProvider = async (slug: string): Promise<void> => {
    try {
      await client.settingsMutate('llm-pi-ai', [{ op: 'unset', path: ['providers', slug] }])
      refresh()
    } catch (e) { setError(String(e)) }
  }

  return (
    <div>
      {error && <div className="conn-banner conn-banner-error">{error}</div>}
      {notice && <div className="conn-banner">{notice}</div>}

      <div className="settings-subtitle">{t('setThirdParty')}</div>
      <div className="text-dim text-xs settings-hint">{t('setThirdPartyDesc')}</div>
      {thirdParty.map((p) => (
        <div key={p.provider} className="thirdparty-row">
          <span className="thirdparty-name">{p.displayName}</span>
          <code className="text-dim text-xs">{p.provider}</code>
          <span className={`dot ${p.active ? 'dot-ok' : 'dot-off'}`} />
          <div className="flex-1" />
          <button className="btn btn-danger" onClick={() => void removeProvider(p.provider)}>{t('delete')}</button>
        </div>
      ))}
      {thirdParty.length === 0 && <div className="text-dim text-xs py-1">{t('setThirdPartyEmpty')}</div>}
      {adding ? (
        <ProviderForm onDone={(message) => { setNotice(message); setAdding(false); refresh() }} />
      ) : (
        <button className="btn" onClick={() => { setAdding(true); setNotice(null) }}>＋ {t('setProviderAdd')}</button>
      )}

      <div className="settings-subtitle">{t('setProviders')}</div>
      <div className="provider-list">
        {providers.filter((p) => p.active || p.declared).map((p) => (
          <span key={p.provider} className={`pill${p.active ? ' provider-active' : ''}`}>
            {p.displayName}{p.active ? ` · ${t('active')}` : ''}
          </span>
        ))}
      </div>

      <div className="settings-subtitle">{t('setModelCatalog')}</div>
      {groups.map((group) => (
        <div key={group.id} className="model-group">
          <div className="model-group-name">{group.name}</div>
          {group.models.map((model) => (
            <div key={model.id} className="model-row">
              <span className="model-name">{model.name}</span>
              {model.reasoning?.efforts && (
                <span className="model-efforts">
                  {model.reasoning.efforts.map((effort) => (
                    <span key={effort.id} className={`pill${effort.id === model.reasoning?.defaultEffort ? ' provider-active' : ''}`}>
                      {effort.name}
                    </span>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="settings-subtitle">{t('setCredentials')}</div>
      {COMMON_REFS.map((ref) => (
        <CredRow key={ref} refName={ref} view={creds[ref]} onChanged={refreshCreds} />
      ))}
    </div>
  )
}

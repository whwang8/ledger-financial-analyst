import type { AgentConfig, Provider } from './agent';
const value = (name: string) => {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw : '';
};
export function providerStatus() {
  return {
    enabled: value('ENABLE_LIVE_LLM') === 'true',
    openai: !!value('OPENAI_API_KEY'),
    anthropic: !!value('ANTHROPIC_API_KEY'),
    default_provider:
      value('LLM_PROVIDER') === 'anthropic' ? 'anthropic' : 'openai',
  };
}
export function agentConfig(provider: Provider): AgentConfig {
  if (value('ENABLE_LIVE_LLM') !== 'true')
    throw new Error(
      'Live inference is off. Set ENABLE_LIVE_LLM=true on the server after configuring your API key.',
    );
  const key = value(
    provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY',
  );
  if (!key)
    throw new Error(
      `Add ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} to .env.local and restart the server to run real analysis.`,
    );
  return {
    provider,
    key,
    model:
      value(provider === 'openai' ? 'OPENAI_MODEL' : 'ANTHROPIC_MODEL') ||
      value('LLM_MODEL') ||
      (provider === 'openai' ? 'gpt-5.6-luna' : 'claude-sonnet-5'),
  };
}

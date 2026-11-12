# Validação Pro com Google Apps Script

1. Crie uma planilha Google e uma aba chamada `Codigos`.
2. Na primeira linha use os cabeçalhos: `codigo | usado | deviceId | data`.
3. Cadastre cada código único na coluna A (uma linha por licença).
4. Abra Extensões → Apps Script, cole `Code.gs` e substitua `SHEET_ID` pelo ID da planilha.
5. Implante como Aplicativo da Web, executar como sua conta, acesso conforme sua política de distribuição. Copie a URL `/exec`.
6. Em `pro-config.js`, defina `endpoint` com a URL publicada.
7. Para CORS, o Apps Script normalmente responde ao POST simples; se o navegador bloquear, implemente um proxy/fluxo compatível ou use validação por formulário GET. Não coloque segredos no frontend.

**Limitação:** identificador local do navegador não é uma identidade inviolável. Limpar dados, reinstalar ou usar outro navegador pode criar outro ID. Para proteção comercial forte, use autenticação/backend.

# Configurazione Supabase — da fare sulla dashboard

## 1. URL Configuration (Authentication > URL Configuration)

**Site URL:**
```
https://clippo.app
```

**Redirect URLs (aggiungere tutti):**
```
https://clippo.app/**
https://clippo.app/auth/
https://clippo.app/auth/reset/
https://clippo.app/auth/logout/
https://clippo.app/archive/
http://localhost:3000/**
```

Il wildcard `**` copre tutti i sub-path. Questo risolve l'errore `otp_expired` che in realtà è un errore di redirect non autorizzato.

## 2. Email Confirmation (Authentication > Providers > Email)

Attualmente è DISABILITATO. Abilitarlo:
- **Confirm email:** ON
- **Secure email change:** ON (consigliato)

Nota: chi è già registrato senza conferma continuerà a funzionare. La conferma si applica solo ai nuovi signup.

## 3. Email Templates (Authentication > Email Templates)

Personalizzare i template con il brand Clippo. Supabase supporta HTML completo.

### Template "Confirm signup"

**Subject:**
```
Confirm your Clippo account
```

**Body:** (vedi `email-templates/confirm-signup.html`)

### Template "Reset password"

**Subject:**
```
Reset your Clippo password
```

**Body:** (vedi `email-templates/reset-password.html`)

### Template "Magic Link"

**Subject:**
```
Your Clippo magic link
```

**Body:** (vedi `email-templates/magic-link.html`)

## 4. Verifica

- [ ] Fai signup con un account pulito → ricevi email conferma brandizzata
- [ ] Clicca link conferma → arrivi su clippo.app/auth/ loggato
- [ ] Fai logout
- [ ] Fai "Forgot password?" → ricevi email reset brandizzata
- [ ] Clicca link → arrivi su clippo.app/auth/reset/ con form per nuova password
- [ ] Cambi password → sei reindirizzato al login

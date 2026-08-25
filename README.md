# Mi Portafolio Cripto v1.2

Incluye todo lo de v1.1 más contexto de mercado por cripto:

- Mínimo y máximo de 24 horas.
- Mínimo y máximo de los últimos 365 días.
- Barra visual con la posición del precio actual dentro del rango anual.
- Máximo histórico (ATH).
- Fecha del ATH.
- Distancia porcentual al ATH.
- Caché local del contexto de mercado para reducir llamadas innecesarias.
- Compras múltiples, metas, ubicaciones, distribución y respaldo JSON.
- PWA instalable.
- Sin claves privadas de exchanges ni permisos de trading.

Fuentes de datos:
- CoinGecko /coins/{id} para mercado, 24h y ATH.
- CoinGecko /coins/{id}/market_chart?days=365 para el rango anual.

Los datos dependen de disponibilidad y límites de la API pública.

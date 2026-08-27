# Mi Portafolio Cripto v1.7.4 — reparación interna de precios

- Valida que una respuesta HTTP realmente contenga precios antes de aceptarla.
- CoinGecko ya no puede reemplazar precios válidos por una respuesta vacía.
- Respaldo por símbolo con Binance y Coinbase.
- Tres fuentes alternativas para USD/MXN.
- Mezcla resultados parciales y conserva siempre el último precio válido.
- Importa respaldos antiguos convirtiendo buyPrice 0 a dato desconocido.
- Si no hay ningún precio, el total muestra — en lugar de un $0 engañoso.

# Mi Portafolio Cripto v1.7.2 — corrección de guardado incompleto

- Se puede guardar una cripto aunque todavía no tenga precio de compra.
- También se puede guardar como seguimiento aunque aún no se capture una compra/cantidad.
- Precio de compra vacío se conserva como dato desconocido, nunca como 0.
- Los cálculos de costo, promedio y P/L quedan en “—” cuando falta el costo.
- El guardado se completa antes de cualquier consulta a CoinGecko.
- Las consultas de contexto de mercado ya no se hacen una por una de forma secuencial.
- Caché PWA renovada y archivos JS/CSS versionados para evitar que iPhone use la copia anterior.

# Mi Portafolio Cripto v1.6

Novedades:
- Simulador para bajar precio promedio por activo.
- Montos rápidos editables y persistentes por moneda (MXN/USD).
- Monto personalizado para probar cualquier inversión.
- Escenarios con nuevo promedio, reducción del promedio y subida necesaria para recuperar.
- Calculadora inversa: cuánto invertir para alcanzar un promedio objetivo.
- Conserva detalle por exchange/wallet y compras individuales de v1.5.

# Mi Portafolio Cripto v1.5

Novedades:
- Cartera tipo acordeón por cripto.
- Compras agrupadas por exchange/wallet.
- Cada exchange/wallet se despliega para mostrar sus compras individuales.
- Cada compra muestra cantidad, precio de compra, invertido, valor actual y ganancia/pérdida.
- Editar y eliminar una compra individual sin afectar las demás.
- Conserva metas, contexto de mercado, ATH, rango anual, distribución y respaldo JSON.

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


## v1.3
- Lista de criptos compacta tipo acordeón.
- Toca una cripto para desplegar todos sus detalles.
- Botones Editar y Eliminar visibles dentro de la ficha desplegada.
- Precio y valor siguen visibles aun con la ficha cerrada.


## v1.4
- Cartera en acordeón real: cada cripto inicia cerrada y al tocarla despliega toda su información.
- Solo una ficha permanece abierta a la vez.
- Editar y Eliminar permanecen dentro de la ficha desplegada.
- Caché PWA renovada para evitar que iPhone siga mostrando una versión anterior.

## v1.7 — Capital nuevo y objetivos por compra
- Cada compra puede marcarse como Largo plazo, Recuperación o Nueva oportunidad.
- Cada compra puede tener un objetivo de salida propio, sin obligar a cerrar todas las compras de una cripto juntas.
- El simulador ahora compara: promediar la posición actual, abrir un lote independiente de la misma cripto y evaluar otra cripto con entrada/objetivo manuales.
- Conserva el cálculo de cuánto capital se necesita para bajar a un promedio objetivo.
- Todos los cálculos son informativos y no ejecutan operaciones.


## v1.7.3
- Actualización de precios robusta: CoinGecko primario y respaldo Binance + USD/MXN.
- Las consultas de contexto ya no se disparan masivamente después de cada actualización de precios.
- Bloqueo de solicitudes simultáneas, timeout y caché local de últimos precios válidos.
- Refresco automático reducido a cada 10 minutos para disminuir límites de API.


## v1.7.5 - Reset total
Se añadió un botón **Reset total** dentro de Respaldo. Borra únicamente los datos locales de esta app (cartera, compras, metas, precios guardados y contexto/caché de mercado), con doble confirmación y limpieza de la caché PWA.

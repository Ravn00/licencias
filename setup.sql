CREATE INDEX IF NOT EXISTS idx_partes_data_company_id ON partes ((data->>'company_id'));
CREATE INDEX IF NOT EXISTS idx_partes_data_codigo_oem ON partes ((data->>'codigoOem'));
CREATE INDEX IF NOT EXISTS idx_partes_data_ubicacion ON partes ((data->>'ubicacion'));
CREATE INDEX IF NOT EXISTS idx_partes_data_posicion ON partes ((data->>'posicion'));
CREATE INDEX IF NOT EXISTS idx_clientes_data_company_id ON clientes ((data->>'company_id'));
CREATE INDEX IF NOT EXISTS idx_ventas_data_company_id ON ventas ((data->>'company_id'));

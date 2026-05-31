export type ResumeParseStatus = 'pending' | 'parsing' | 'parsed' | 'failed';

export interface ResumeCargo {
  empresa?: string | null;
  cargo?: string | null;
  periodo?: string | null;
  descricao?: string | null;
}

export interface ResumeFormacao {
  instituicao?: string | null;
  curso?: string | null;
  ano_conclusao?: string | null;
}

export interface ResumeIdioma {
  nome: string;
  nivel?: string | null;
}

export interface ResumeCertificacao {
  nome: string;
  ano?: string | null;
}

export interface ResumeParsedData {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  experiencia_total_anos?: number | null;
  cargos?: ResumeCargo[];
  formacao?: ResumeFormacao[];
  idiomas?: ResumeIdioma[];
  certificacoes?: ResumeCertificacao[];
  skills?: string[];
  localizacao_cidade_estado?: string | null;
}

export interface Resume {
  id: string;
  user_id: string;
  contact_id: string;
  vacancy_id: string | null;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  parsed_data: ResumeParsedData;
  parse_status: ResumeParseStatus;
  parse_error: string | null;
  score_meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

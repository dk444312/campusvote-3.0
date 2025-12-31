export interface Candidate {
  id: string;
  name: string;
  manifesto: string;
  image_url: string;
  position: string;
}

export interface Voter {
  id: string;
  code: string;
  has_voted: boolean;
  created_at: string;
}

export interface VoteResult {
  candidate_id: string;
  candidate_name: string;
  vote_count: number;
  position: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum AuthState {
  SETUP = 'SETUP',
  LOGIN = 'LOGIN',
  VOTER_DASHBOARD = 'VOTER_DASHBOARD',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  SUCCESS = 'SUCCESS'
}

-- Fix score constraints to allow 0-100 scale (matching AI evaluation output)
ALTER TABLE evaluations DROP CONSTRAINT evaluations_communication_score_check;
ALTER TABLE evaluations DROP CONSTRAINT evaluations_technical_score_check;
ALTER TABLE evaluations DROP CONSTRAINT evaluations_personality_match_check;
ALTER TABLE evaluations DROP CONSTRAINT evaluations_overall_score_check;

ALTER TABLE evaluations ADD CONSTRAINT evaluations_communication_score_check CHECK (communication_score >= 0 AND communication_score <= 100);
ALTER TABLE evaluations ADD CONSTRAINT evaluations_technical_score_check CHECK (technical_score >= 0 AND technical_score <= 100);
ALTER TABLE evaluations ADD CONSTRAINT evaluations_personality_match_check CHECK (personality_match >= 0 AND personality_match <= 100);
ALTER TABLE evaluations ADD CONSTRAINT evaluations_overall_score_check CHECK (overall_score >= 0 AND overall_score <= 100);
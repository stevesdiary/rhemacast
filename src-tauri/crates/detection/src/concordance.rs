use std::collections::HashMap;
use std::time::{Duration, Instant};

use regex::Regex;
use serde::{Deserialize, Serialize};

use rhema_bible::{BibleDb, ConcordanceEntry};

const COOLDOWN_DURATION: Duration = Duration::from_secs(20);

/// A detected concordance entry from spoken sermon audio.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcordanceDetection {
    pub entry: ConcordanceEntry,
    pub confidence: f64,
    pub matched_term: String,
    pub transcript_snippet: String,
    pub trigger_phrase: Option<String>,
}

pub struct ConcordanceDetector {
    trigger_patterns: Vec<Regex>,
    keyword_map: HashMap<&'static str, &'static str>, // alias -> strongs_number
    cooldowns: HashMap<String, Instant>,
}

impl Default for ConcordanceDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl ConcordanceDetector {
    pub fn new() -> Self {
        let trigger_patterns = vec![
            Regex::new(r"(?i)\b(?:in|from)\s+the\s+(?:greek|hebrew)\b(?:\s+(?:it\s+is|word\s+is|is))?\s+([a-zA-Z]+)").unwrap(),
            Regex::new(r"(?i)\bthe\s+(?:greek|hebrew)\s+word\s+(?:here\s+)?(?:is\s+)?([a-zA-Z]+)").unwrap(),
            Regex::new(r"(?i)\b(?:original|root)\s+word\s+(?:here\s+)?(?:is\s+)?([a-zA-Z]+)").unwrap(),
            Regex::new(r"(?i)\b(?:greek|hebrew)\s+for\s+[a-zA-Z]+\s+is\s+([a-zA-Z]+)").unwrap(),
        ];

        let mut keyword_map = HashMap::new();
        // Greek preaching terms
        for alias in &["kairos", "cairos", "kyros", "kayros", "kiros"] {
            keyword_map.insert(*alias, "G2540");
        }
        for alias in &["rhema", "rema", "rayma", "rehma"] {
            keyword_map.insert(*alias, "G4487");
        }
        for alias in &["logos", "logoss"] {
            keyword_map.insert(*alias, "G3056");
        }
        for alias in &["zoe", "zoey", "zoee", "zowee"] {
            keyword_map.insert(*alias, "G2222");
        }
        for alias in &["dunamis", "dynamis", "doonamis", "dunamiss"] {
            keyword_map.insert(*alias, "G1411");
        }
        for alias in &["agape", "agapay", "agapey"] {
            keyword_map.insert(*alias, "G26");
        }
        for alias in &["parakletos", "paraclete", "paraklete", "paracletos"] {
            keyword_map.insert(*alias, "G3875");
        }
        for alias in &["pneuma", "neuma"] {
            keyword_map.insert(*alias, "G4151");
        }
        for alias in &["charis", "haris"] {
            keyword_map.insert(*alias, "G5485");
        }
        for alias in &["dikaiosune", "dikaiosyne"] {
            keyword_map.insert(*alias, "G1343");
        }
        for alias in &["metanoia", "metanoya"] {
            keyword_map.insert(*alias, "G3341");
        }
        for alias in &["koinonia", "coynonia"] {
            keyword_map.insert(*alias, "G2842");
        }
        for alias in &["mysterion", "misterion"] {
            keyword_map.insert(*alias, "G3466");
        }
        for alias in &["euaggelion", "evangelion", "euangelion"] {
            keyword_map.insert(*alias, "G2098");
        }
        for alias in &["soteria"] {
            keyword_map.insert(*alias, "G4991");
        }
        for alias in &["ekklesia", "ecclesia"] {
            keyword_map.insert(*alias, "G1577");
        }

        // Hebrew preaching terms
        for alias in &["shalom", "shalome", "shalowm", "shaloam"] {
            keyword_map.insert(*alias, "H7965");
        }
        for alias in &["hesed", "chesed", "khesed"] {
            keyword_map.insert(*alias, "H2617");
        }
        for alias in &["ruach", "ruah", "ruakh"] {
            keyword_map.insert(*alias, "H7307");
        }
        for alias in &["yahweh", "yahveh", "yehovah", "jehovah"] {
            keyword_map.insert(*alias, "H3068");
        }
        for alias in &["elohim", "elohiym"] {
            keyword_map.insert(*alias, "H430");
        }
        for alias in &["adonai", "adonay"] {
            keyword_map.insert(*alias, "H136");
        }
        for alias in &["berit", "berith"] {
            keyword_map.insert(*alias, "H1285");
        }
        for alias in &["kabod", "kavod", "chabod"] {
            keyword_map.insert(*alias, "H3519");
        }
        for alias in &["qodesh", "kodesh"] {
            keyword_map.insert(*alias, "H6944");
        }
        for alias in &["nephesh", "nefesh"] {
            keyword_map.insert(*alias, "H5315");
        }
        for alias in &["chokmah", "hokhmah"] {
            keyword_map.insert(*alias, "H2451");
        }
        for alias in &["torah"] {
            keyword_map.insert(*alias, "H8451");
        }

        Self {
            trigger_patterns,
            keyword_map,
            cooldowns: HashMap::new(),
        }
    }

    /// Clean up expired cooldowns
    fn prune_cooldowns(&mut self, now: Instant) {
        self.cooldowns.retain(|_, time| now.duration_since(*time) < COOLDOWN_DURATION);
    }

    /// Check if a Strong's number is currently in cooldown
    fn is_in_cooldown(&self, strongs_number: &str, now: Instant) -> bool {
        if let Some(time) = self.cooldowns.get(strongs_number) {
            now.duration_since(*time) < COOLDOWN_DURATION
        } else {
            false
        }
    }

    /// Detect concordance terms in transcript text
    pub fn detect(&mut self, text: &str, db: &BibleDb) -> Vec<ConcordanceDetection> {
        let now = Instant::now();
        self.prune_cooldowns(now);

        let mut results = Vec::new();
        let mut matched_strongs = std::collections::HashSet::new();

        // 1. Scan for explicit trigger phrases ("in the Greek, kairos", "the Greek word rhema", etc.)
        for pattern in &self.trigger_patterns {
            for cap in pattern.captures_iter(text) {
                if let (Some(full_match), Some(word_match)) = (cap.get(0), cap.get(1)) {
                    let target_word = word_match.as_str().to_lowercase();
                    let trigger_text = full_match.as_str().to_string();

                    // Lookup by alias or database transliteration
                    let entries = if let Some(strongs) = self.keyword_map.get(target_word.as_str()) {
                        db.get_concordance_entry(strongs).ok().flatten().into_iter().collect()
                    } else {
                        db.lookup_concordance_by_word(&target_word).unwrap_or_default()
                    };

                    for entry in entries {
                        if !self.is_in_cooldown(&entry.strongs_number, now)
                            && matched_strongs.insert(entry.strongs_number.clone())
                        {
                            self.cooldowns.insert(entry.strongs_number.clone(), now);
                            results.push(ConcordanceDetection {
                                entry,
                                confidence: 0.95,
                                matched_term: target_word.clone(),
                                transcript_snippet: text.trim().to_string(),
                                trigger_phrase: Some(trigger_text.clone()),
                            });
                        }
                    }
                }
            }
        }

        // 2. Scan for theological keywords and qualifiers (e.g., "kairos time", "rhema word", "zoe life")
        let lower = text.to_lowercase();
        // Split on non-alphanumeric
        let words: Vec<&str> = lower
            .split(|c: char| !c.is_alphanumeric())
            .filter(|s| !s.is_empty())
            .collect();

        for i in 0..words.len() {
            let word = words[i];
            if let Some(strongs) = self.keyword_map.get(word) {
                if matched_strongs.contains(*strongs) || self.is_in_cooldown(strongs, now) {
                    continue;
                }

                // Check for theological pair bonus
                let is_paired = match *strongs {
                    "G2540" => lower.contains("kairos time") || lower.contains("season"),
                    "G4487" => lower.contains("rhema word") || lower.contains("spoken word"),
                    "G3056" => lower.contains("logos word") || lower.contains("living word"),
                    "G2222" => lower.contains("zoe life") || lower.contains("god kind of life"),
                    "G1411" => lower.contains("dunamis power") || lower.contains("dynamite power"),
                    "G26"   => lower.contains("agape love") || lower.contains("unconditional love"),
                    "G3875" => lower.contains("holy spirit") || lower.contains("comforter"),
                    "H7965" => lower.contains("peace") || lower.contains("shalom aleichem"),
                    "H2617" => lower.contains("covenant love") || lower.contains("lovingkindness"),
                    "H7307" => lower.contains("spirit") || lower.contains("breath of god"),
                    _ => false,
                };

                let confidence = if is_paired { 0.92 } else { 0.85 };

                if let Ok(Some(entry)) = db.get_concordance_entry(strongs) {
                    matched_strongs.insert(entry.strongs_number.clone());
                    self.cooldowns.insert(entry.strongs_number.clone(), now);
                    results.push(ConcordanceDetection {
                        entry,
                        confidence,
                        matched_term: word.to_string(),
                        transcript_snippet: text.trim().to_string(),
                        trigger_phrase: if is_paired { Some("Theological Phrase".to_string()) } else { None },
                    });
                }
            }
        }

        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyword_map_contains_essentials() {
        let detector = ConcordanceDetector::new();
        assert_eq!(detector.keyword_map.get("kairos"), Some(&"G2540"));
        assert_eq!(detector.keyword_map.get("rema"), Some(&"G4487"));
        assert_eq!(detector.keyword_map.get("zoe"), Some(&"G2222"));
        assert_eq!(detector.keyword_map.get("shalom"), Some(&"H7965"));
    }
}

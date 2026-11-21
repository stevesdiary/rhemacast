use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Song {
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub composer: Option<String>,
    pub copyright: Option<String>,
    pub ccli_number: Option<String>,
    pub themes: Vec<String>, // JSON deserialized
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SongSection {
    pub id: i64,
    pub song_id: i64,
    pub section_type: SectionType,
    pub section_number: i32,
    pub lyrics: String,
    pub order_index: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SectionType {
    Verse,
    Chorus,
    Bridge,
    PreChorus,
    Tag,
    Intro,
    Outro,
    Other(String),
}

impl std::str::FromStr for SectionType {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.to_lowercase().as_str() {
            "verse" => SectionType::Verse,
            "chorus" => SectionType::Chorus,
            "bridge" => SectionType::Bridge,
            "pre_chorus" => SectionType::PreChorus,
            "tag" => SectionType::Tag,
            "intro" => SectionType::Intro,
            "outro" => SectionType::Outro,
            other => SectionType::Other(other.to_string()),
        })
    }
}

impl SectionType {
    pub fn as_str(&self) -> &str {
        match self {
            SectionType::Verse => "verse",
            SectionType::Chorus => "chorus",
            SectionType::Bridge => "bridge",
            SectionType::PreChorus => "pre_chorus",
            SectionType::Tag => "tag",
            SectionType::Intro => "intro",
            SectionType::Outro => "outro",
            SectionType::Other(s) => s,
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        <Self as std::str::FromStr>::from_str(s).unwrap_or(SectionType::Verse)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SongWithSections {
    pub song: Song,
    pub sections: Vec<SongSection>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SearchSongRow {
    pub song_id: i64,
    pub title: String,
    pub author: Option<String>,
    pub section_type: String,
    pub section_number: i32,
    pub lyrics: String,
    pub rank: f64,
    pub phrase_match: bool,
}
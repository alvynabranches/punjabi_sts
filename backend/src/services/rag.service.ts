import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

interface GurbaniRecord {
    quote_gurbani: string;
    phonetic_transliteration: string;
    academic_transliteration: string;
    english_translation_1: string;
    english_translation_2: string;
    punjabi_translation_1: string;
    punjabi_translation_2: string;
    arth_translation: string;
    bani_reference_citation: string;
    philosophical_interpretation: string;
}

interface SearchResult {
    id: number;
    score: number;
    payload: GurbaniRecord;
}

@Injectable()
export class RagService {
    private qdrantUrl: string;
    private collectionName = 'gurbani_collection';

    constructor(private configService: ConfigService) {
        this.qdrantUrl = this.configService.get<string>('QDRANT_URL') || 'http://qdrant:6333';
    }

    /**
     * Search for relevant Gurbani passages based on a query
     * @param query The search query
     * @param limit Maximum number of results to return
     * @returns Array of search results with Gurbani records
     */
    async searchGurbani(query: string, limit: number = 10): Promise<SearchResult[]> {
        try {
            // First, get embedding for the query using the embedding API
            const embedding = await this.getEmbedding(query);

            if (!embedding) {
                throw new Error('Failed to generate embedding for query');
            }

            // Search Qdrant with the embedding
            return await this.searchQdrant(embedding, limit);
        } catch (error) {
            console.error('Error searching Gurbani:', error);
            return [];
        }
    }

    /**
     * Get embedding for a text using an embedding API
     * @param text The text to embed
     * @returns Vector embedding as number array
     */
    private async getEmbedding(text: string): Promise<number[] | null> {
        try {
            // For production, you would use a proper embedding API like OpenAI or a local model
            // This is a simplified example using OpenAI's embedding API
            const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');

            if (!openaiApiKey) {
                throw new Error('OpenAI API key not configured');
            }

            const response = await axios.post(
                'https://api.openai.com/v1/embeddings',
                {
                    input: text,
                    model: 'text-embedding-3-small'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${openaiApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.data[0].embedding;
        } catch (error) {
            console.error('Error generating embedding:', error);
            return null;
        }
    }

    /**
     * Search Qdrant with an embedding vector
     * @param embedding The embedding vector
     * @param limit Maximum number of results
     * @returns Search results
     */
    private async searchQdrant(embedding: number[], limit: number): Promise<SearchResult[]> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            const response = await axios.post(
                `${this.qdrantUrl}/collections/${this.collectionName}/points/search`,
                {
                    vector: embedding,
                    limit: limit,
                    with_payload: true,
                    with_vectors: false
                },
                { headers }
            );

            return response.data.result.map((item: { id: number; score: number; payload: unknown }) => ({
                id: item.id,
                score: item.score,
                payload: item.payload as GurbaniRecord
            }));
        } catch (error) {
            console.error('Error searching Qdrant:', error);
            return [];
        }
    }

    /**
     * Format search results into a readable response
     * @param results Search results from Qdrant
     * @param language The language code for the response
     * @returns Formatted response string
     */
    formatSearchResults(results: SearchResult[], language: string = 'pa-IN'): string {
        if (results.length === 0) {
            return 'No relevant Gurbani passages found.';
        }

        let response = '';

        // Add introduction
        if (language === 'pa-IN') {
            response += 'ਇਹ ਪ੍ਰਸ਼ਨ ਸ੍ਰੀ ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ ਜੀ ਦੀ ਬਾਣੀ ਵਿੱਚ ਸਿੱਧੇ ਤੌਰ ਤੇ ਉੱਤਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।\n\n';
        } else {
            response += 'This question is directly answered in the Sri Guru Granth Sahib Ji\'s Bani.\n\n';
        }

        // Add each result with its reference and translation
        results.forEach((result, index) => {
            const record = result.payload;

            // Add the Gurbani quote with reference
            response += `${record.quote_gurbani} — ${record.bani_reference_citation}\n\n`;

            // Add translation based on language
            if (language === 'pa-IN') {
                response += `${record.punjabi_translation_1}\n\n`;
            } else if (language === 'en-US') {
                response += `${record.english_translation_1}\n\n`;
            } else if (language === 'hi-IN') {
                // Fallback to English if Hindi not available
                response += `${record.english_translation_1}\n\n`;
            }

            // Add philosophical interpretation for deeper understanding
            if (index === 0 && record.philosophical_interpretation) {
                if (language === 'pa-IN') {
                    response += `ਵਿਆਖਿਆ: ${record.arth_translation || record.punjabi_translation_2 || ''}\n\n`;
                } else if (language === 'en-US') {
                    response += `Interpretation: ${record.philosophical_interpretation}\n\n`;
                } else if (language === 'hi-IN') {
                    // Fallback to English if Hindi not available
                    response += `Interpretation: ${record.philosophical_interpretation}\n\n`;
                }
            }

            // Add separator between results
            if (index < results.length - 1) {
                response += '---\n\n';
            }
        });

        return response;
    }
}
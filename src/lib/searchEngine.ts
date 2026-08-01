/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Document } from '../types';

// Helper function to remove Vietnamese diacritics/accents
export function removeVietnameseTones(str: string): string {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  // Some system encodings might use combining diacritics
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return str;
}

// Tokenizes text into lowercase words, removing punctuation
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

export interface SearchResult {
  document: Document;
  score: number;
  matchSnippet: string;
}

/**
 * Advanced BM25 Search Engine
 * Tailored for Vietnamese regulatory search
 */
export class BM25SearchEngine {
  private docs: Document[] = [];
  private k1: number = 1.5; // Term frequency saturation parameter
  private b: number = 0.75; // Document length normalization parameter
  
  // Storage for document representations
  private originalTokensList: string[][] = [];
  private deaccentedTokensList: string[][] = [];
  private docLengths: number[] = [];
  private avgDocLength: number = 0;
  
  // Term frequencies per document: Map<term, term_frequency>[]
  private originalTermFreqs: Map<string, number>[] = [];
  private deaccentedTermFreqs: Map<string, number>[] = [];
  
  // Document frequency across corpus: Map<term, document_count>
  private originalDocFreqs: Map<string, number> = new Map();
  private deaccentedDocFreqs: Map<string, number> = new Map();

  constructor(documents: Document[]) {
    this.docs = documents;
    this.indexDocuments();
  }

  private indexDocuments() {
    this.originalTokensList = [];
    this.deaccentedTokensList = [];
    this.docLengths = [];
    this.originalTermFreqs = [];
    this.deaccentedTermFreqs = [];
    this.originalDocFreqs.clear();
    this.deaccentedDocFreqs.clear();

    if (this.docs.length === 0) {
      this.avgDocLength = 0;
      return;
    }

    let totalLength = 0;

    this.docs.forEach((doc, idx) => {
      // Build indexable text content with structural weights
      // Title (5x), Tags (3x), AI Summary text (2x), Full Text (1x)
      const titleRepeat = Array(5).fill(doc.title).join(' ');
      const tagsRepeat = Array(3).fill(doc.tags.join(' ')).join(' ');
      const summaryText = doc.aiSummary 
        ? `${doc.aiSummary.implications} ${doc.aiSummary.complianceRequirements} ${doc.aiSummary.keyTakeaways.join(' ')}` 
        : '';
      const summaryRepeat = Array(2).fill(summaryText).join(' ');
      
      const fullContent = `${titleRepeat} ${tagsRepeat} ${summaryRepeat} ${doc.docNumber} ${doc.agency} ${doc.fullText} ${doc.inspectionTarget || ''} ${doc.inspectionContent || ''} ${doc.keyContent || ''} ${doc.summaryInstructions || ''}`;
      
      const origTokens = tokenize(fullContent);
      const deaccentedText = removeVietnameseTones(fullContent);
      const deaccTokens = tokenize(deaccentedText);

      this.originalTokensList.push(origTokens);
      this.deaccentedTokensList.push(deaccTokens);
      
      const docLen = origTokens.length;
      this.docLengths.push(docLen);
      totalLength += docLen;

      // Calculate term frequencies for this document
      const origFreq = new Map<string, number>();
      origTokens.forEach(t => {
        origFreq.set(t, (origFreq.get(t) || 0) + 1);
      });
      this.originalTermFreqs.push(origFreq);

      const deaccFreq = new Map<string, number>();
      deaccTokens.forEach(t => {
        deaccFreq.set(t, (deaccFreq.get(t) || 0) + 1);
      });
      this.deaccentedTermFreqs.push(deaccFreq);

      // Record document frequencies (count of docs containing term)
      Array.from(origFreq.keys()).forEach(term => {
        this.originalDocFreqs.set(term, (this.originalDocFreqs.get(term) || 0) + 1);
      });

      Array.from(deaccFreq.keys()).forEach(term => {
        this.deaccentedDocFreqs.set(term, (this.deaccentedDocFreqs.get(term) || 0) + 1);
      });
    });

    this.avgDocLength = totalLength / this.docs.length;
  }

  /**
   * Search across indexed documents using BM25
   */
  public search(queryStr: string): SearchResult[] {
    if (!queryStr || queryStr.trim().length === 0) {
      return this.docs.map(doc => ({
        document: doc,
        score: 0,
        matchSnippet: this.generateSnippet(doc, '')
      }));
    }

    const queryOrigTokens = tokenize(queryStr);
    const queryDeaccTokens = tokenize(removeVietnameseTones(queryStr));
    
    // Determine if query is accented or not (contains non-ASCII characters)
    const isAccentedQuery = queryStr !== removeVietnameseTones(queryStr);
    
    const results: SearchResult[] = [];

    this.docs.forEach((doc, idx) => {
      let score = 0;
      const docLen = this.docLengths[idx];
      
      const termFreqs = isAccentedQuery ? this.originalTermFreqs[idx] : this.deaccentedTermFreqs[idx];
      const docFreqs = isAccentedQuery ? this.originalDocFreqs : this.deaccentedDocFreqs;
      const queryTokens = isAccentedQuery ? queryOrigTokens : queryDeaccTokens;

      queryTokens.forEach(qTerm => {
        const df = docFreqs.get(qTerm) || 0;
        if (df === 0) return; // Term not in corpus

        // IDF calculation (with smoothing to prevent negative values)
        const idf = Math.log(1 + (this.docs.length - df + 0.5) / (df + 0.5));
        
        // Term frequency in this document
        const tf = termFreqs.get(qTerm) || 0;
        
        // BM25 term score
        const termScore = idf * (tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + this.b * docLen / this.avgDocLength));
        score += termScore;
      });

      // Boost scores if keywords match exactly in title (exact sequence match)
      const docTitleNormalized = removeVietnameseTones(doc.title).toLowerCase();
      const queryNormalized = removeVietnameseTones(queryStr).toLowerCase();
      if (docTitleNormalized.includes(queryNormalized)) {
        score += 15.0; // Huge boost for direct string containment in title
      } else {
        // Boost for partial matches
        const docTextNormalized = removeVietnameseTones(doc.fullText).toLowerCase();
        if (docTextNormalized.includes(queryNormalized)) {
          score += 5.0;
        }
      }

      if (score > 0 || queryStr.trim() === '') {
        results.push({
          document: doc,
          score: Math.round(score * 100) / 100,
          matchSnippet: this.generateSnippet(doc, queryStr)
        });
      }
    });

    // Sort descending by BM25 score
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Generates a context snippet around the best matching keyword
   */
  private generateSnippet(doc: Document, queryStr: string): string {
    if (!queryStr) {
      // Return first 160 characters of fullText or aiSummary as default
      const excerpt = doc.aiSummary?.implications || doc.fullText;
      return excerpt.slice(0, 180) + (excerpt.length > 180 ? '...' : '');
    }

    const queryWords = tokenize(removeVietnameseTones(queryStr));
    const fullTextNorm = removeVietnameseTones(doc.fullText).toLowerCase();
    
    // Find the best match position in the text
    let bestPos = 0;
    let maxMatchCount = 0;
    
    // Check positions in text to find window with maximum query terms
    for (let i = 0; i < doc.fullText.length - 150; i += 10) {
      const windowText = fullTextNorm.slice(i, i + 150);
      let matches = 0;
      queryWords.forEach(word => {
        if (windowText.includes(word)) matches++;
      });
      if (matches > maxMatchCount) {
        maxMatchCount = matches;
        bestPos = i;
      }
    }

    // Extract window around best position
    const start = Math.max(0, bestPos - 30);
    const end = Math.min(doc.fullText.length, start + 180);
    
    let snippet = doc.fullText.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < doc.fullText.length) snippet = snippet + '...';
    
    return snippet;
  }
}

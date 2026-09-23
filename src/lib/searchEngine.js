/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
function removeVietnameseTones(str) {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return str;
}
function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, " ").split(/\s+/).filter((token) => token.length > 0);
}
class BM25SearchEngine {
  constructor(documents) {
    this.docs = [];
    this.k1 = 1.5;
    // Term frequency saturation parameter
    this.b = 0.75;
    // Document length normalization parameter
    // Storage for document representations
    this.originalTokensList = [];
    this.deaccentedTokensList = [];
    this.docLengths = [];
    this.avgDocLength = 0;
    // Term frequencies per document: Map<term, term_frequency>[]
    this.originalTermFreqs = [];
    this.deaccentedTermFreqs = [];
    // Document frequency across corpus: Map<term, document_count>
    this.originalDocFreqs = /* @__PURE__ */ new Map();
    this.deaccentedDocFreqs = /* @__PURE__ */ new Map();
    this.docs = documents;
    this.indexDocuments();
  }
  indexDocuments() {
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
      const titleRepeat = Array(5).fill(doc.title).join(" ");
      const tagsRepeat = Array(3).fill(doc.tags.join(" ")).join(" ");
      const summaryText = doc.aiSummary ? `${doc.aiSummary.implications} ${doc.aiSummary.complianceRequirements} ${doc.aiSummary.keyTakeaways.join(" ")}` : "";
      const summaryRepeat = Array(2).fill(summaryText).join(" ");
      const fullContent = `${titleRepeat} ${tagsRepeat} ${summaryRepeat} ${doc.docNumber} ${doc.agency} ${doc.fullText} ${doc.inspectionTarget || ""} ${doc.inspectionContent || ""} ${doc.keyContent || ""} ${doc.summaryInstructions || ""}`;
      const origTokens = tokenize(fullContent);
      const deaccentedText = removeVietnameseTones(fullContent);
      const deaccTokens = tokenize(deaccentedText);
      this.originalTokensList.push(origTokens);
      this.deaccentedTokensList.push(deaccTokens);
      const docLen = origTokens.length;
      this.docLengths.push(docLen);
      totalLength += docLen;
      const origFreq = /* @__PURE__ */ new Map();
      origTokens.forEach((t) => {
        origFreq.set(t, (origFreq.get(t) || 0) + 1);
      });
      this.originalTermFreqs.push(origFreq);
      const deaccFreq = /* @__PURE__ */ new Map();
      deaccTokens.forEach((t) => {
        deaccFreq.set(t, (deaccFreq.get(t) || 0) + 1);
      });
      this.deaccentedTermFreqs.push(deaccFreq);
      Array.from(origFreq.keys()).forEach((term) => {
        this.originalDocFreqs.set(term, (this.originalDocFreqs.get(term) || 0) + 1);
      });
      Array.from(deaccFreq.keys()).forEach((term) => {
        this.deaccentedDocFreqs.set(term, (this.deaccentedDocFreqs.get(term) || 0) + 1);
      });
    });
    this.avgDocLength = totalLength / this.docs.length;
  }
  /**
   * Search across indexed documents using BM25
   */
  search(queryStr) {
    if (!queryStr || queryStr.trim().length === 0) {
      return this.docs.map((doc) => ({
        document: doc,
        score: 0,
        matchSnippet: this.generateSnippet(doc, "")
      }));
    }
    const queryOrigTokens = tokenize(queryStr);
    const queryDeaccTokens = tokenize(removeVietnameseTones(queryStr));
    const isAccentedQuery = queryStr !== removeVietnameseTones(queryStr);
    const results = [];
    this.docs.forEach((doc, idx) => {
      let score = 0;
      const docLen = this.docLengths[idx];
      const termFreqs = isAccentedQuery ? this.originalTermFreqs[idx] : this.deaccentedTermFreqs[idx];
      const docFreqs = isAccentedQuery ? this.originalDocFreqs : this.deaccentedDocFreqs;
      const queryTokens = isAccentedQuery ? queryOrigTokens : queryDeaccTokens;
      queryTokens.forEach((qTerm) => {
        const df = docFreqs.get(qTerm) || 0;
        if (df === 0) return;
        const idf = Math.log(1 + (this.docs.length - df + 0.5) / (df + 0.5));
        const tf = termFreqs.get(qTerm) || 0;
        const termScore = idf * (tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + this.b * docLen / this.avgDocLength));
        score += termScore;
      });
      const docTitleNormalized = removeVietnameseTones(doc.title).toLowerCase();
      const queryNormalized = removeVietnameseTones(queryStr).toLowerCase();
      if (docTitleNormalized.includes(queryNormalized)) {
        score += 15;
      } else {
        const docTextNormalized = removeVietnameseTones(doc.fullText).toLowerCase();
        if (docTextNormalized.includes(queryNormalized)) {
          score += 5;
        }
      }
      if (score > 0 || queryStr.trim() === "") {
        results.push({
          document: doc,
          score: Math.round(score * 100) / 100,
          matchSnippet: this.generateSnippet(doc, queryStr)
        });
      }
    });
    return results.sort((a, b) => b.score - a.score);
  }
  /**
   * Generates a context snippet around the best matching keyword
   */
  generateSnippet(doc, queryStr) {
    if (!queryStr) {
      const excerpt = doc.aiSummary?.implications || doc.fullText;
      return excerpt.slice(0, 180) + (excerpt.length > 180 ? "..." : "");
    }
    const queryWords = tokenize(removeVietnameseTones(queryStr));
    const fullTextNorm = removeVietnameseTones(doc.fullText).toLowerCase();
    let bestPos = 0;
    let maxMatchCount = 0;
    for (let i = 0; i < doc.fullText.length - 150; i += 10) {
      const windowText = fullTextNorm.slice(i, i + 150);
      let matches = 0;
      queryWords.forEach((word) => {
        if (windowText.includes(word)) matches++;
      });
      if (matches > maxMatchCount) {
        maxMatchCount = matches;
        bestPos = i;
      }
    }
    const start = Math.max(0, bestPos - 30);
    const end = Math.min(doc.fullText.length, start + 180);
    let snippet = doc.fullText.slice(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < doc.fullText.length) snippet = snippet + "...";
    return snippet;
  }
}
export {
  BM25SearchEngine,
  removeVietnameseTones,
  tokenize
};

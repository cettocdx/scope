interface XimilarTag {
  name: string;
  prob: number;
}

interface XimilarCategory {
  name: string;
  prob: number;
}

interface XimilarRecord {
  _status: {
    code: number;
    text: string;
  };
  _tags?: XimilarTag[];
  _objects?: Array<{
    name: string;
    prob: number;
    bound_box?: number[];
    _tags?: XimilarTag[];
  }>;
}

interface XimilarResponse {
  records: XimilarRecord[];
  status: {
    code: number;
    text: string;
  };
}

export interface XimilarAnalysisResult {
  success: boolean;
  category?: string;
  subcategory?: string;
  gender?: string;
  color?: string;
  material?: string;
  pattern?: string;
  style?: string;
  brand?: string;
  tags: string[];
  confidence: number;
  rawTags?: XimilarTag[];
  error?: string;
}

export async function analyzeWithXimilar(imageBase64: string): Promise<XimilarAnalysisResult> {
  const apiKey = process.env.XIMILAR_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      tags: [],
      confidence: 0,
      error: "XIMILAR_API_KEY not configured"
    };
  }

  try {
    const response = await fetch("https://api.ximilar.com/tagging/fashion/v2/tags", {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        records: [
          {
            _base64: imageBase64
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ximilar API error:", response.status, errorText);
      return {
        success: false,
        tags: [],
        confidence: 0,
        error: `Ximilar API error: ${response.status}`
      };
    }

    const data: XimilarResponse = await response.json();
    
    if (data.status?.code !== 200 || !data.records?.[0]) {
      return {
        success: false,
        tags: [],
        confidence: 0,
        error: "Invalid Ximilar response"
      };
    }

    const record = data.records[0];
    const tags = record._tags || [];
    
    const result: XimilarAnalysisResult = {
      success: true,
      tags: tags.map(t => t.name),
      confidence: 0,
      rawTags: tags
    };

    for (const tag of tags) {
      const name = tag.name.toLowerCase();
      
      if (["top", "bottom", "dress", "outerwear", "footwear", "bag", "accessory", "jewelry"].some(c => name.includes(c))) {
        result.category = tag.name;
        if (tag.prob > result.confidence) result.confidence = tag.prob;
      }
      
      if (["shirt", "t-shirt", "blouse", "sweater", "jacket", "coat", "pants", "jeans", "skirt", "shorts", "boots", "sneakers", "heels", "sandals", "loafers", "handbag", "tote", "clutch", "backpack", "crossbody"].some(s => name.includes(s))) {
        result.subcategory = tag.name;
      }
      
      if (["men", "women", "unisex", "male", "female"].some(g => name.includes(g))) {
        result.gender = tag.name;
      }
      
      if (["black", "white", "red", "blue", "green", "yellow", "pink", "purple", "brown", "beige", "grey", "gray", "orange", "navy", "cream", "tan", "burgundy", "olive", "coral", "turquoise", "gold", "silver"].some(c => name.includes(c))) {
        result.color = tag.name;
      }
      
      if (["leather", "suede", "canvas", "denim", "cotton", "wool", "silk", "satin", "velvet", "nylon", "polyester", "linen", "cashmere", "fur", "patent", "mesh"].some(m => name.includes(m))) {
        result.material = tag.name;
      }
      
      if (["solid", "striped", "plaid", "checkered", "floral", "polka dot", "animal print", "leopard", "zebra", "camouflage", "geometric", "abstract", "paisley", "houndstooth", "tartan"].some(p => name.includes(p))) {
        result.pattern = tag.name;
      }
      
      if (["casual", "formal", "sporty", "elegant", "vintage", "bohemian", "minimalist", "streetwear", "classic", "modern", "luxury", "designer"].some(s => name.includes(s))) {
        result.style = tag.name;
      }
    }

    result.confidence = Math.round(result.confidence * 100);
    
    console.log("Ximilar analysis result:", {
      category: result.category,
      subcategory: result.subcategory,
      color: result.color,
      material: result.material,
      tagsCount: result.tags.length,
      confidence: result.confidence
    });

    return result;
  } catch (error) {
    console.error("Ximilar analysis error:", error);
    return {
      success: false,
      tags: [],
      confidence: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function searchSimilarProducts(imageBase64: string): Promise<any[]> {
  const apiKey = process.env.XIMILAR_API_KEY;
  
  if (!apiKey) {
    console.error("XIMILAR_API_KEY not configured for visual search");
    return [];
  }

  try {
    const response = await fetch("https://api.ximilar.com/similarity/fashion/v2/visualSearch", {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        records: [
          {
            _base64: imageBase64
          }
        ],
        k: 10
      })
    });

    if (!response.ok) {
      console.error("Ximilar visual search error:", response.status);
      return [];
    }

    const data = await response.json();
    return data.records?.[0]?._similar || [];
  } catch (error) {
    console.error("Ximilar visual search error:", error);
    return [];
  }
}

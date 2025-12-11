interface ClarifaiConcept {
  id: string;
  name: string;
  value: number;
}

interface ClarifaiOutput {
  data: {
    concepts?: ClarifaiConcept[];
  };
}

interface ClarifaiResponse {
  outputs?: ClarifaiOutput[];
  status?: {
    code: number;
    description: string;
  };
}

export interface ClarifaiAnalysisResult {
  success: boolean;
  concepts: Array<{ name: string; confidence: number }>;
  topCategory?: string;
  suggestedBrands: string[];
  colors: string[];
  materials: string[];
  styles: string[];
  error?: string;
}

const FASHION_BRANDS = [
  "prada", "gucci", "louis vuitton", "chanel", "hermes", "dior", "fendi", "bottega veneta",
  "balenciaga", "saint laurent", "valentino", "versace", "burberry", "givenchy", "celine",
  "loewe", "alexander mcqueen", "miu miu", "tom ford", "jimmy choo", "christian louboutin",
  "manolo blahnik", "ferragamo", "coach", "michael kors", "kate spade", "tory burch",
  "nike", "adidas", "new balance", "converse", "vans", "golden goose", "off-white"
];

const COLOR_TERMS = [
  "black", "white", "red", "blue", "green", "yellow", "pink", "purple", "brown", "beige",
  "grey", "gray", "orange", "navy", "cream", "tan", "burgundy", "olive", "gold", "silver"
];

const MATERIAL_TERMS = [
  "leather", "suede", "canvas", "denim", "cotton", "wool", "silk", "satin", "velvet",
  "nylon", "polyester", "linen", "cashmere", "patent", "mesh", "rubber", "metal"
];

const STYLE_TERMS = [
  "casual", "formal", "sporty", "elegant", "vintage", "bohemian", "minimalist", "streetwear",
  "classic", "modern", "luxury", "designer", "athletic", "preppy", "edgy", "chic"
];

export async function analyzeWithClarifai(imageBase64: string): Promise<ClarifaiAnalysisResult> {
  const apiKey = process.env.CLARIFAI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      concepts: [],
      suggestedBrands: [],
      colors: [],
      materials: [],
      styles: [],
      error: "CLARIFAI_API_KEY not configured"
    };
  }

  try {
    const response = await fetch(
      "https://api.clarifai.com/v2/models/general-image-recognition/outputs",
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: [
            {
              data: {
                image: {
                  base64: imageBase64
                }
              }
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Clarifai API error:", response.status, errorText);
      return {
        success: false,
        concepts: [],
        suggestedBrands: [],
        colors: [],
        materials: [],
        styles: [],
        error: `Clarifai API error: ${response.status}`
      };
    }

    const data: ClarifaiResponse = await response.json();
    
    if (!data.outputs?.[0]?.data?.concepts) {
      return {
        success: false,
        concepts: [],
        suggestedBrands: [],
        colors: [],
        materials: [],
        styles: [],
        error: "No concepts found in Clarifai response"
      };
    }

    const concepts = data.outputs[0].data.concepts.map(c => ({
      name: c.name,
      confidence: Math.round(c.value * 100)
    }));

    const result: ClarifaiAnalysisResult = {
      success: true,
      concepts,
      suggestedBrands: [],
      colors: [],
      materials: [],
      styles: []
    };

    for (const concept of concepts) {
      const name = concept.name.toLowerCase();
      
      const matchedBrand = FASHION_BRANDS.find(b => name.includes(b) || b.includes(name));
      if (matchedBrand && !result.suggestedBrands.includes(matchedBrand)) {
        result.suggestedBrands.push(matchedBrand);
      }
      
      const matchedColor = COLOR_TERMS.find(c => name.includes(c));
      if (matchedColor && !result.colors.includes(matchedColor)) {
        result.colors.push(matchedColor);
      }
      
      const matchedMaterial = MATERIAL_TERMS.find(m => name.includes(m));
      if (matchedMaterial && !result.materials.includes(matchedMaterial)) {
        result.materials.push(matchedMaterial);
      }
      
      const matchedStyle = STYLE_TERMS.find(s => name.includes(s));
      if (matchedStyle && !result.styles.includes(matchedStyle)) {
        result.styles.push(matchedStyle);
      }
    }

    if (concepts.length > 0) {
      result.topCategory = concepts[0].name;
    }

    console.log("Clarifai analysis result:", {
      topCategory: result.topCategory,
      conceptsCount: concepts.length,
      suggestedBrands: result.suggestedBrands,
      colors: result.colors,
      materials: result.materials
    });

    return result;
  } catch (error) {
    console.error("Clarifai analysis error:", error);
    return {
      success: false,
      concepts: [],
      suggestedBrands: [],
      colors: [],
      materials: [],
      styles: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function analyzeApparelWithClarifai(imageBase64: string): Promise<ClarifaiAnalysisResult> {
  const apiKey = process.env.CLARIFAI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      concepts: [],
      suggestedBrands: [],
      colors: [],
      materials: [],
      styles: [],
      error: "CLARIFAI_API_KEY not configured"
    };
  }

  try {
    const response = await fetch(
      "https://api.clarifai.com/v2/models/apparel-detection/outputs",
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: [
            {
              data: {
                image: {
                  base64: imageBase64
                }
              }
            }
          ]
        })
      }
    );

    if (!response.ok) {
      console.log("Apparel detection not available, falling back to general");
      return analyzeWithClarifai(imageBase64);
    }

    const data: ClarifaiResponse = await response.json();
    
    if (!data.outputs?.[0]?.data?.concepts) {
      return analyzeWithClarifai(imageBase64);
    }

    const concepts = data.outputs[0].data.concepts.map(c => ({
      name: c.name,
      confidence: Math.round(c.value * 100)
    }));

    return {
      success: true,
      concepts,
      topCategory: concepts[0]?.name,
      suggestedBrands: [],
      colors: [],
      materials: [],
      styles: []
    };
  } catch (error) {
    console.error("Clarifai apparel detection error, falling back:", error);
    return analyzeWithClarifai(imageBase64);
  }
}

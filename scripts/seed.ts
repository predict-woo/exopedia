import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  generateEmbedding,
  chunkText,
  generateEmbeddings,
} from "../lib/embeddings";

// Load environment variables
config({ path: ".env.local" });

// Create Supabase client with service role key for seeding
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mainPageContent = `## 엑소피디아: 단편화된 미래의 기록

3025년의 현재, 엑소피디아에 오신 것을 환영합니다.

엑소피디아(Exopedia)는 인류가 태양계를 넘어 새로운 별을 향해 나아갔으나, 빛의 속도라는 절대적인 장벽 앞에서 분열되고 흩어진 문명들의 지식을 집대성하려는 시도입니다. 모든 내용은 3025년의 관점에서 과거에 일어난 사건으로 기록됩니다.

이곳의 지식은 통일된 역사서가 아닌, 각 행성계와 세력권에서 축적된 파편화된 기록들의 총체입니다. 당신의 탐험은 단절된 인류의 조각들을 잇는 여정이 될 것입니다.

-----

### **3025년의 인류: 확장과 고립**

지난 천 년간 인류는 태양이라는 요람을 벗어나는 데 성공했습니다. 그러나 우주를 향한 위대한 여정은 인류를 하나의 위대한 문명으로 묶어주지 못했습니다. 광속을 넘을 수 없는 물리 법칙의 한계는 항성계 간 수십, 수백 년의 통신 지연을 낳았고, 이는 각 인류 공동체가 독자적인 문화와 기술, 심지어는 다른 종에 가까운 가치관을 발전시키는 결과를 낳았습니다.

인류는 더 이상 단일한 종이 아닐지도 모릅니다.

#### **내태양계: 오래된 권력과 새로운 질서**

  * **[지구권 연합](/create/earth-sphere-coalition):** 한때 인류의 유일한 중심이었던 지구와 그 주변의 우주 콜로니들은 이제 수많은 세력 중 하나로 남았습니다. 과거의 영광과 자원을 기반으로 여전히 막강한 영향력을 행사하지만, [자원 고갈 문제](/create/resource-depletion-on-earth)와 [오래된 기술 인프라의 노후화](/create/aging-tech-infrastructure)는 이들의 발목을 잡고 있습니다.

  * **[화성 독립 도시국가](/create/martian-independent-city-states):** 붉은 행성은 결코 제2의 지구가 되지 못했습니다. 수백 년에 걸친 [테라포밍 프로젝트](/create/great-martian-terraforming-project)는 행성의 대기를 미약하게 만들었을 뿐, 인류는 여전히 거대한 [돔 도시](/create/martian-dome-cities)나 [지하 도시](/create/underground-cities-of-mars)에 의존해 살아갑니다. 혹독한 환경은 화성인들의 강인하고 독립적인 문화를 낳았으며, 이들은 지구의 영향력에서 벗어나 독자적인 길을 걷고 있습니다.

  * **[금성 기업령](/create/corporate-dominions-of-venus):** 금성의 상층 대기에 떠 있는 [부유 도시](/create/venusian-floating-cities)들은 특정 거대 기업들의 소유입니다. 고도의 자동화 기술과 독점적인 [대기 자원 채굴](/create/atmospheric-mining)을 통해 막대한 부를 쌓았으며, 이들의 경제력은 때로 국가의 힘을 능가합니다.

#### **외태양계: 무법과 가능성의 땅**

  * **[목성권 공화국 연맹](/create/federation-of-jovian-republics):** 이오의 화산 지대부터 유로파의 얼음 아래까지, 목성의 위성들은 각기 다른 정치 체제를 지닌 소규모 국가들의 연합체입니다. 특히 [유로파의 해저 도시](/create/subglacial-cities-of-europa)는 외부와 거의 단절된 채 독특한 생태계와 문화를 발전시켰습니다. 이곳은 태양계의 핵심 에너지원인 [헬륨-3 채굴](/create/helium-3-mining)의 중심지이며, 이를 둘러싼 갈등이 끊이지 않습니다.

  * **[타이탄과 그 너머의 개척자들](/create/pioneers-of-titan-and-beyond):** 토성의 위성 타이탄은 메탄과 에탄의 바다를 기반으로 한 [탄화수소 경제](/create/hydrocarbon-economy)의 중심지입니다. 이곳과 소행성 벨트의 [자원 채굴 기지](/create/asteroid-belt-mining-outposts)들은 중앙 정부의 통제가 거의 닿지 않는 무법 지대에 가까우며, 개인의 자유와 위험이 공존하는 곳입니다.

#### **항성간 식민지: 지연된 시간 속의 문명들**

광속의 한계 내에서 이루어진 [준광속 항성간 여행](/create/sub-light-interstellar-travel)은 마침내 인류를 여러 항성계에 닿게 하는 데 성공했습니다. 하지만 광속의 장벽은 물리적 교류뿐 아니라 정보의 흐름마저 극도로 지연시켜, 각 식민지는 태양계와는 수십 년, 혹은 수백 년의 '시간차'를 가진 채 독자적으로 진화하고 있습니다. 우리는 이들의 과거 기록을 받아볼 뿐, 이들의 현재를 알지 못합니다.

  * **[알파 센타우리 | 상호연대](/create/alpha-centauri-solidarity):** 인류 최초의 항성간 식민지이자 태양계와 가장 활발히 교류하는 곳입니다. 편도 4.3년의 통신 지연은 여전히 존재하지만, 지속적인 [저속 데이터 패킷 교환](/create/slow-packet-data-exchange)을 통해 이들의 역사, 사회 구조, 문화에 대한 방대한 자료가 태양계에 축적되어 있습니다. 하지만 우리가 접하는 정보는 최소 4년 전의 과거이며, 이들의 현재 정치적 격변이나 사회적 유행은 언제나 시간차를 두고 알려져 '실시간으로 갱신되는 역사책'에 비유되곤 합니다.

  * **[타우 세티 | 광개토](/create/tau-ceti-gwanggaeto):** 약 12광년 떨어진 이 식민지는 독자적인 생태계를 가진 행성 '장보고'를 개척하며 독자 노선을 걷고 있습니다. 24년에 달하는 왕복 통신 시간으로 인해 타우 세티는 사실상 독립 문명으로 간주됩니다. 태양계의 연구자들은 3000년대 초반의 [타우 세티 공화국](/create/republic-of-tau-ceti)의 정치 체제나 문화에 대해서는 해박하지만, 이후 수십 년간 어떤 변화를 겪었는지는 도착할 정보 패킷을 기다리며 추측할 뿐입니다.

  * **[볼프 359 | 텐진 개척지](/create/wolf-359-tenjin-terminus):** 목성권 자유도시 연맹의 한 분파가 독자적으로 개척한 식민지입니다. 이들은 생존과 직결된 최소한의 기술 정보 외에는 거의 교류하지 않아 [베일에 싸인 식민지](/create/veiled-colonies)로 불립니다. 이들의 폐쇄적인 태도는 기술적 문제 때문인지, 아니면 의도적인 고립주의 때문인지에 대한 논쟁이 계속되고 있습니다.

  * **[침묵의 별들](/create/the-silent-stars):** 지난 수백 년간 더 먼 별들을 향해 출발했던 수많은 [세대 항해선](/create/generation-ships) 중 일부는 목표 항성계에 도달했다는 첫 신호 이후 통신이 두절되었습니다. 이들이 재앙을 맞았는지, 아니면 스스로 외부 세계와의 연결을 끊었는지는 확인할 방법이 없습니다. 이들은 인류의 우주 개척이 지닌 위험성을 상징하는 존재로 남아있습니다.

### **주요 역사적 흐름과 개념**

  * **[제1차 에너지 위기와 우주 개척 시대의 개막](/create/first-energy-crisis-and-the-dawn-of-space-age):** 22세기, 지구의 화석 연료 고갈이 인류를 우주로 내몰았던 결정적 사건.
  * **[화성 독립 전쟁](/create/martian-independence-war):** 25세기, 화성 식민지가 지구의 통제에 맞서 벌인 길고 처절했던 전쟁.
  * **[광속 장벽과 문명의 고립](/create/light-barrier-and-civilizational-isolation):** 정보 전달의 한계가 어떻게 인류 문명을 분화시켰는가에 대한 탐구.
  * **[에너지 경제학](/create/energy-economics):** 에너지의 생산, 저장, 효율이 모든 경제 활동의 근간이 된 이유.
  * **[외계 생명체 탐사](/create/search-for-extraterrestrial-life):** 지적 생명체는 발견되지 않았으나, 여러 행성에서 발견된 [단세포 생물](/create/extraterrestrial-microbes)과 [단순 식물군](/create/alien-flora)의 기록.
  * **[기술의 불완전성](/create/technological-imperfection):** 최첨단 기술과 구식 기술이 아슬아슬하게 공존하는 사회의 모습.

-----

### **탐험을 시작하세요**

엑소피디아는 당신의 호기심을 통해 성장합니다. 위의 링크들을 클릭하여 3025년 인류의 파편화된 세계를 더 깊이 탐험해 보세요. 각 문서는 서로 연결되어 있으며, 하나의 기록은 또 다른 질문으로 이어질 것입니다.

*"지식은 고립을 넘어서는 유일한 다리다."* - 엑소피디아 창립 모토`;

const mainPageSummary = `엑소피디아는 3025년의 관점에서 미래를 기록하는 가상의 디지털 백과사전입니다. 인류는 별들을 향해 나아갔지만 광속의 한계로 인해 각 문명은 수십 년의 시간차를 두고 고립되었습니다. 이곳에서 당신은 단절된 인류의 파편화된 기록들을 탐험하며 흩어진 미래의 조각들을 맞춰나갈 수 있습니다.`;

async function seedDatabase() {
  try {
    console.log("Starting database seed...");

    // Check if main page already exists
    const { data: existing } = await supabase
      .from("pages")
      .select("slug")
      .eq("slug", "main")
      .single();

    if (existing) {
      console.log("Main page already exists, skipping seed.");
      return;
    }

    // Upload markdown to storage
    const storageObjectPath = "pages/main.md";
    const { error: uploadError } = await supabase.storage
      .from("pages")
      .upload(storageObjectPath, mainPageContent, {
        contentType: "text/markdown",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading to storage:", uploadError);
      throw uploadError;
    }

    // Insert page metadata
    const { data: page, error: insertError } = await supabase
      .from("pages")
      .insert({
        slug: "main",
        title: "엑소피디아 메인 페이지",
        storage_object_path: storageObjectPath,
        summary: mainPageSummary,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting page:", insertError);
      throw insertError;
    }

    console.log("Created main page with ID:", page.id);

    // Generate and store summary embedding
    console.log("Generating summary embedding...");
    const summaryEmbedding = await generateEmbedding(mainPageSummary);

    const { error: summaryEmbedError } = await supabase
      .from("summary_embeddings")
      .insert({
        page_id: page.id,
        embedding: summaryEmbedding,
      });

    if (summaryEmbedError) {
      console.error("Error inserting summary embedding:", summaryEmbedError);
      throw summaryEmbedError;
    }

    // Chunk content and generate embeddings
    console.log("Generating content embeddings...");
    const chunks = chunkText(mainPageContent);
    const chunkEmbeddings = await generateEmbeddings(chunks);

    const contentEmbeddingRecords = chunks.map((chunk, index) => ({
      page_id: page.id,
      chunk_index: index,
      content: chunk,
      embedding: chunkEmbeddings[index],
    }));

    const { error: contentEmbedError } = await supabase
      .from("content_embeddings")
      .insert(contentEmbeddingRecords);

    if (contentEmbedError) {
      console.error("Error inserting content embeddings:", contentEmbedError);
      throw contentEmbedError;
    }

    console.log(
      `Successfully seeded database with main page and ${chunks.length} content chunks!`
    );
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();

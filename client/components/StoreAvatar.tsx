import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { Colors } from "@/constants/theme";
import { Txt } from "@/components/ui";

/** Well-known store names → their site, so we can show a real logo. */
const KNOWN_DOMAINS: [RegExp, string][] = [
  [/amazon/i, "amazon.com"],
  [/best ?buy/i, "bestbuy.com"],
  [/walmart/i, "walmart.com"],
  [/\btarget\b/i, "target.com"],
  [/\bapple\b/i, "apple.com"],
  [/samsung/i, "samsung.com"],
  [/media ?markt/i, "mediamarkt.de"],
  [/\bsaturn\b/i, "saturn.de"],
  [/\bfnac\b/i, "fnac.com"],
  [/darty/i, "darty.com"],
  [/el corte/i, "elcorteingles.es"],
  [/currys/i, "currys.co.uk"],
  [/\bargos\b/i, "argos.co.uk"],
  [/john lewis/i, "johnlewis.com"],
  [/\botto\b/i, "otto.de"],
  [/zalando/i, "zalando.com"],
  [/coolblue/i, "coolblue.nl"],
  [/bol\.?com/i, "bol.com"],
  [/hepsiburada/i, "hepsiburada.com"],
  [/trendyol/i, "trendyol.com"],
  [/teknosa/i, "teknosa.com"],
  [/vatan/i, "vatanbilgisayar.com"],
  [/\bn11\b/i, "n11.com"],
  [/b&h|bhphoto/i, "bhphotovideo.com"],
  [/newegg/i, "newegg.com"],
  [/costco/i, "costco.com"],
  [/\bnike\b/i, "nike.com"],
  [/adidas/i, "adidas.com"],
  [/sephora/i, "sephora.com"],
  [/\bsony\b/i, "sony.com"],
  [/\bbose\b/i, "bose.com"],
  [/\bdyson\b/i, "dyson.com"],
  [/philips/i, "philips.com"],
  [/xiaomi/i, "mi.com"],
  [/lenovo/i, "lenovo.com"],
  [/\bdell\b/i, "dell.com"],
  [/\blg\b/i, "lg.com"],
  [/\bikea\b/i, "ikea.com"],
  [/decathlon/i, "decathlon.com"],
  [/\bzara\b/i, "zara.com"],
  [/h&m/i, "hm.com"],
  [/cdiscount/i, "cdiscount.com"],
  [/boulanger/i, "boulanger.com"],
  [/pccomponentes/i, "pccomponentes.com"],
  [/unieuro/i, "unieuro.it"],
  [/aliexpress/i, "aliexpress.com"],
  [/\btemu\b/i, "temu.com"],
];

function domainFor(store: string, domain: string | null): string | null {
  if (domain) return domain;
  // Shops that list under their web address ("pazarama.com") name themselves.
  const host = store.trim().toLowerCase();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return host;
  for (const [re, d] of KNOWN_DOMAINS) if (re.test(store)) return d;
  return null;
}

export function StoreAvatar({
  store,
  domain,
  size = 36,
}: {
  store: string;
  domain: string | null;
  size?: number;
}) {
  const d = domainFor(store, domain);
  const [failed, setFailed] = useState(false);
  const radius = size * 0.28;

  return (
    <View
      style={[styles.box, { width: size, height: size, borderRadius: radius }]}
    >
      {d && !failed ? (
        <Image
          source={{
            uri: `https://www.google.com/s2/favicons?domain=${d}&sz=128`,
          }}
          style={{ width: size * 0.62, height: size * 0.62, borderRadius: 4 }}
          contentFit="contain"
          onError={() => setFailed(true)}
          cachePolicy="disk"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Txt variant="headline" color={Colors.textInverse}>
          {store.trim().charAt(0).toUpperCase() || "?"}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#F5F5F2",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

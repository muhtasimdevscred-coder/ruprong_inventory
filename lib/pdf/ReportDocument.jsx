import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { getLogoDataUri } from "../logoData";

const GOLD = "#8a6a45";
const LIGHT = "#f7f1e8";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#222" },
  logo: { width: 110, height: 73.7, objectFit: "contain", marginBottom: 8 },
  title: { fontSize: 18, color: GOLD, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 10, marginTop: 2, marginBottom: 10 },
  hr: { borderBottomWidth: 1, borderBottomColor: GOLD, marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, width: "55%" },
  summaryLabelGold: { color: GOLD, fontSize: 9.5 },
  summaryLabel: { fontSize: 9.5 },
  summaryValue: { fontSize: 9.5, textAlign: "right", fontFamily: "Helvetica-Bold" },
  note: { fontSize: 8.5, color: "#555", marginTop: 6, marginBottom: 6 },
  sectionLabel: { color: GOLD, fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 4 },
  tHeadRow: { flexDirection: "row", backgroundColor: GOLD, paddingVertical: 5, paddingHorizontal: 5 },
  tHeadCell: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 8 },
  tRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 5 },
  tRowAlt: { backgroundColor: LIGHT },
});

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const invCols = [
  { key: "invoice_no", label: "Invoice No", w: "16%" },
  { key: "date", label: "Date", w: "11%" },
  { key: "customer", label: "Customer", w: "20%" },
  { key: "subtotal", label: "Subtotal", w: "11%", num: true },
  { key: "discount", label: "Discount", w: "11%", num: true },
  { key: "delivery", label: "Delivery", w: "10%", num: true },
  { key: "total", label: "Total", w: "10.5%", num: true },
  { key: "profit", label: "Profit", w: "10.5%", num: true },
];

const prodCols = [
  { key: "description", label: "Product", w: "40%" },
  { key: "qty", label: "Qty Sold", w: "15%", num: true },
  { key: "revenue", label: "Revenue", w: "15%", num: true },
  { key: "cost", label: "Cost", w: "15%", num: true },
  { key: "profit", label: "Profit", w: "15%", num: true },
];

export default function ReportDocument({ start, end, summary }) {
  const { totals, byInvoice, byProduct } = summary;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image src={getLogoDataUri()} style={styles.logo} />
        <Text style={styles.title}>Sales & Profit Report</Text>
        <Text style={styles.subtitle}>Period: {start} to {end}</Text>
        <View style={styles.hr} />

        {[
          ["Invoices", totals.invoiceCount, false],
          ["Gross Sales (before discount)", money(totals.subtotal), false],
          ["Total Discount Given", money(totals.discount), false],
          ["Total Delivery Charges", money(totals.delivery), false],
          ["Net Revenue", money(totals.revenue), false],
          ["Cost of Goods Sold", money(totals.cost), true],
          ["Net Profit", money(totals.profit), true],
          ["Profit Margin", `${totals.marginPct.toFixed(1)}%`, false],
        ].map(([label, value]) => (
          <View style={styles.summaryRow} key={label}>
            <Text style={styles.summaryLabelGold}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
          </View>
        ))}

        {totals.unknownCostLines > 0 && (
          <Text style={styles.note}>
            Note: {totals.unknownCostLines} line item(s) in this period had no cost price on
            record, counted as zero cost above — actual profit may be lower than shown.
          </Text>
        )}

        <Text style={styles.sectionLabel}>By Invoice</Text>
        <View style={styles.tHeadRow}>
          {invCols.map((c) => (
            <Text key={c.key} style={[styles.tHeadCell, { width: c.w, textAlign: c.num ? "right" : "left" }]}>
              {c.label}
            </Text>
          ))}
        </View>
        {byInvoice.length === 0 && <Text style={{ padding: 6, fontSize: 9 }}>No invoices in this period.</Text>}
        {byInvoice.map((row, i) => (
          <View style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} key={row.invoice_no}>
            {invCols.map((c) => (
              <Text key={c.key} style={{ width: c.w, textAlign: c.num ? "right" : "left" }}>
                {c.num ? money(row[c.key]) : String(row[c.key])}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.sectionLabel}>By Product</Text>
        <View style={styles.tHeadRow}>
          {prodCols.map((c) => (
            <Text key={c.key} style={[styles.tHeadCell, { width: c.w, textAlign: c.num ? "right" : "left" }]}>
              {c.label}
            </Text>
          ))}
        </View>
        {byProduct.length === 0 && <Text style={{ padding: 6, fontSize: 9 }}>No sales in this period.</Text>}
        {byProduct.map((row, i) => (
          <View style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} key={row.description}>
            {prodCols.map((c) => (
              <Text key={c.key} style={{ width: c.w, textAlign: c.num ? "right" : "left" }}>
                {c.num ? money(row[c.key]) : String(row[c.key])}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

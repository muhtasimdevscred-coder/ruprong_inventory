import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { getLogoDataUri } from "../logoData";

const GOLD = "#8a6a45";
const LIGHT = "#f7f1e8";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#222" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 130, height: 130 * (1371 / 2048), objectFit: "contain" },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: GOLD },
  brandSub: { fontSize: 8, letterSpacing: 2, color: "#8a7a63", marginTop: 2 },
  titleBlock: { alignItems: "flex-end" },
  title: { fontSize: 22, color: GOLD, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  metaLine: { fontSize: 9, marginBottom: 2, textAlign: "right" },
  metaBold: { fontFamily: "Helvetica-Bold" },
  hr: { borderBottomWidth: 1, borderBottomColor: GOLD, marginVertical: 14 },
  hrThin: { borderBottomWidth: 0.5, borderBottomColor: "#c9a876", marginVertical: 10 },
  billLabel: { color: GOLD, fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  billName: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 2 },
  billLine: { fontSize: 9, marginBottom: 1 },
  table: { marginTop: 16 },
  tHeadRow: { flexDirection: "row", backgroundColor: GOLD, paddingVertical: 6, paddingHorizontal: 6 },
  tHeadCell: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 9 },
  tRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  tRowAlt: { backgroundColor: LIGHT },
  colNum: { width: "6%" },
  colDesc: { width: "44%" },
  colQty: { width: "12%", textAlign: "right" },
  colPrice: { width: "19%", textAlign: "right" },
  colTotal: { width: "19%", textAlign: "right" },
  summaryBlock: { marginTop: 10, alignSelf: "flex-end", width: "50%" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  summaryLabel: { fontSize: 9.5 },
  summaryValue: { fontSize: 9.5, textAlign: "right" },
  grandRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, borderTopWidth: 1, borderTopColor: GOLD, marginTop: 4 },
  grandLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 30, fontSize: 9, color: "#555" },
});

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceDocument({ invoice, items }) {
  const hasDiscount = Number(invoice.discount_amount) > 0;
  const hasDelivery = Number(invoice.delivery_charge) > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={getLogoDataUri()} style={styles.logo} />
          <View style={styles.titleBlock}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.metaLine}>
              Invoice No: <Text style={styles.metaBold}>{invoice.invoice_no}</Text>
            </Text>
            <Text style={styles.metaLine}>
              Date: {new Date(invoice.invoice_date).toISOString().slice(0, 10)}
            </Text>
            {invoice.parcel_id ? <Text style={styles.metaLine}>Parcel ID: {invoice.parcel_id}</Text> : null}
          </View>
        </View>

        <View style={styles.hr} />

        <Text style={styles.billLabel}>BILL TO</Text>
        <Text style={styles.billName}>{invoice.customer_name}</Text>
        {invoice.customer_phone ? <Text style={styles.billLine}>{invoice.customer_phone}</Text> : null}
        {invoice.customer_address ? <Text style={styles.billLine}>{invoice.customer_address}</Text> : null}

        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.tHeadCell, styles.colNum]}>#</Text>
            <Text style={[styles.tHeadCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tHeadCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tHeadCell, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.tHeadCell, styles.colTotal]}>Total</Text>
          </View>
          {items.map((li, i) => (
            <View style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : {}]} key={li.id}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <Text style={styles.colDesc}>{li.description}</Text>
              <Text style={styles.colQty}>{li.quantity}</Text>
              <Text style={styles.colPrice}>{money(li.unit_price)}</Text>
              <Text style={styles.colTotal}>{money(li.line_total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryBlock}>
          {(hasDiscount || hasDelivery) && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{money(invoice.subtotal)}</Text>
            </View>
          )}
          {hasDiscount && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Discount {invoice.discount_type === "percent" ? `(${invoice.discount_value}%)` : ""}
              </Text>
              <Text style={styles.summaryValue}>-{money(invoice.discount_amount)}</Text>
            </View>
          )}
          {hasDelivery && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Charge</Text>
              <Text style={styles.summaryValue}>{money(invoice.delivery_charge)}</Text>
            </View>
          )}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Grand Total</Text>
            <Text style={styles.grandValue}>{money(invoice.total)}</Text>
          </View>
        </View>

        <View style={styles.hrThin} />
        <Text style={styles.footer}>Thank you for shopping with RupRong by Ananna.</Text>
      </Page>
    </Document>
  );
}

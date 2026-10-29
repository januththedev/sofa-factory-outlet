import { relations } from 'drizzle-orm';
import { bookingItems, bookings, bookingSlots } from './bookings';
import {
  categories,
  categoryComplements,
  productVariants,
  products,
} from './catalogue';
import { chatConversations, chatMessages } from './chat';
import { invoiceItems, invoices, payments } from './invoices';
import { kbChunks, kbDocuments } from './knowledge';
import { customers } from './people';
import { reviews } from './seo';

export * from './leads';
export * from './admin';
export * from './analytics';
export * from './bookings';
export * from './catalogue';
export * from './chat';
export * from './invoices';
export * from './knowledge';
export * from './people';
export * from './seo';
export * from './types';

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'parent',
  }),
  children: many(categories, { relationName: 'parent' }),
  products: many(products),
  complements: many(categoryComplements, { relationName: 'complementOf' }),
}));

export const categoryComplementsRelations = relations(
  categoryComplements,
  ({ one }) => ({
    category: one(categories, {
      fields: [categoryComplements.categoryId],
      references: [categories.id],
      relationName: 'complementOf',
    }),
    complement: one(categories, {
      fields: [categoryComplements.complementId],
      references: [categories.id],
    }),
  }),
);

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  reviews: many(reviews),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
  }),
);

export const customersRelations = relations(customers, ({ many }) => ({
  bookings: many(bookings),
  invoices: many(invoices),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(customers, {
    fields: [bookings.customerId],
    references: [customers.id],
  }),
  slot: one(bookingSlots, {
    fields: [bookings.slotId],
    references: [bookingSlots.id],
  }),
  items: many(bookingItems),
}));

export const bookingItemsRelations = relations(bookingItems, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingItems.bookingId],
    references: [bookings.id],
  }),
  product: one(products, {
    fields: [bookingItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [bookingItems.variantId],
    references: [productVariants.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  booking: one(bookings, {
    fields: [invoices.bookingId],
    references: [bookings.id],
  }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const kbDocumentsRelations = relations(kbDocuments, ({ many }) => ({
  chunks: many(kbChunks),
}));

export const kbChunksRelations = relations(kbChunks, ({ one }) => ({
  document: one(kbDocuments, {
    fields: [kbChunks.documentId],
    references: [kbDocuments.id],
  }),
}));

export const chatConversationsRelations = relations(
  chatConversations,
  ({ many }) => ({
    messages: many(chatMessages),
  }),
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
}));

import type { Product } from "./product";

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  DISPUTED = "DISPUTED",
}

export interface ShippingAddress {
  line1: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  phone?: string;
}

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  status: OrderStatus;
  originalAmount: string;
  discountedAmount: string | null;
  totalAmount: string;
  commissionAmount: string | null;
  discountId: string | null;
  shippingAddress: ShippingAddress;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  productName: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
}

export interface Cart {
  id: string;
  buyerId: string;
  items: CartItem[];
}

export interface CartLine extends CartItem {
  product: Pick<Product, "id" | "name" | "slug" | "price" | "stock" | "imageUrl"> | null;
}

export interface CartDetails {
  id: string;
  buyerId: string;
  items: CartLine[];
}

import { describe, expect, it, vi } from "vitest";
import { TransactionType } from "@tradeloop/types";
import { WalletRepository } from "../wallet/wallet.repository";
import { EscrowService } from "./escrow.service";

function setup() {
  const wallets = {
    debitAtomic: vi.fn(),
    creditAtomic: vi.fn(),
    recordTransaction: vi.fn(),
  };
  const service = new EscrowService(wallets as unknown as WalletRepository);
  return { service, wallets };
}

const RUNNER = {} as never;

describe("EscrowService", () => {
  it("holds buyer funds with a hold record", async () => {
    const { service, wallets } = setup();

    await service.holdFunds({
      buyerWalletId: "buyer-w",
      escrowWalletId: "escrow-w",
      amount: "5000.00",
      orderId: "o-1",
      runner: RUNNER,
    });

    expect(wallets.debitAtomic).toHaveBeenCalledWith("buyer-w", "5000.00", RUNNER);
    expect(wallets.creditAtomic).toHaveBeenCalledWith("escrow-w", "5000.00", RUNNER);
    expect(wallets.recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        fromWalletId: "buyer-w",
        toWalletId: "escrow-w",
        amount: "5000.00",
        type: TransactionType.ESCROW_HOLD,
        referenceId: "o-1",
      }),
      RUNNER,
    );
  });

  it("splits releases into commission and seller records", async () => {
    const { service, wallets } = setup();

    await service.releaseFunds({
      escrowWalletId: "escrow-w",
      sellerWalletId: "seller-w",
      platformWalletId: "platform-w",
      totalAmount: "5000.00",
      netAmount: "4500.00",
      commissionAmount: "500.00",
      orderId: "o-1",
      runner: RUNNER,
    });

    expect(wallets.debitAtomic).toHaveBeenCalledWith("escrow-w", "5000.00", RUNNER);
    expect(wallets.creditAtomic).toHaveBeenCalledWith("platform-w", "500.00", RUNNER);
    expect(wallets.creditAtomic).toHaveBeenCalledWith("seller-w", "4500.00", RUNNER);
    expect(wallets.recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: TransactionType.COMMISSION, amount: "500.00" }),
      RUNNER,
    );
    expect(wallets.recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: TransactionType.ESCROW_RELEASE, amount: "4500.00" }),
      RUNNER,
    );
  });

  it("refunds escrow back to buyers", async () => {
    const { service, wallets } = setup();

    await service.refundFunds({
      escrowWalletId: "escrow-w",
      buyerWalletId: "buyer-w",
      amount: "5000.00",
      orderId: "o-1",
      runner: RUNNER,
    });

    expect(wallets.debitAtomic).toHaveBeenCalledWith("escrow-w", "5000.00", RUNNER);
    expect(wallets.creditAtomic).toHaveBeenCalledWith("buyer-w", "5000.00", RUNNER);
    expect(wallets.recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: TransactionType.REFUND, referenceId: "o-1" }),
      RUNNER,
    );
  });
});

"use client";

import { AlertTriangle, Github, ShieldQuestion, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";

const disclaimerSections = [
  {
    title: "Educational & Research Purposes Only",
    body: "TradeBlocks is designed for educational exploration and research analysis of trading strategies. Nothing within this platform constitutes investment advice, trading recommendations, or financial guidance of any kind.",
    accent: "text-destructive",
  },
  {
    title: "Your Data, Your Responsibility",
    body: "All calculations, metrics, and insights are generated from the historical data you provide. We make no guarantees about data accuracy, completeness, or the validity of your trading logs. Quality analysis requires quality data — imperfect inputs will produce unreliable results.",
    accent: "text-primary",
  },
  {
    title: "Software & Technical Limitations",
    body: "Like all software, TradeBlocks may contain errors, bugs, or unexpected behaviors. Our algorithms make assumptions that may not align with your specific trading circumstances. Historical performance analysis cannot predict future market outcomes.",
    accent: "text-secondary-foreground",
  },
  {
    title: "Financial Risk Acknowledgment",
    body: "Trading and investing carry substantial risk of loss. You may lose part or all of your investment capital. Before making any financial decisions, consult with qualified financial professionals who understand your individual situation.",
    accent: "text-destructive",
  },
  {
    title: "Privacy & Data Handling",
    body: "TradeBlocks operates entirely in your browser using local storage, indexDB, and session cookies to maintain your data and preferences. We do not transmit, store, or access your trading data on external servers.",
    accent: "text-muted-foreground",
  },
];

export function SidebarFooterLegal() {
  return (
    <div className="space-y-4 border-t border-sidebar-border/80 px-3 pb-6 pt-4 text-[0.72rem] leading-relaxed text-muted-foreground">
      <Alert className="gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
        <div className="space-y-1">
          <AlertTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            Important Notice
          </AlertTitle>
          <AlertDescription className="text-[0.72rem] text-foreground">
            Educational use only • Not financial advice • Trading involves risk
          </AlertDescription>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-[0.72rem] font-medium text-primary"
              >
                Full Disclaimer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto border-none bg-gradient-to-b from-background to-muted/40 p-0 sm:max-w-2xl">
              <DialogTitle className="sr-only">Full Disclaimer</DialogTitle>
              <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-card p-6 shadow-2xl sm:p-8">
                <DialogHeader className="gap-2 text-left">
                  <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <AlertTriangle
                      className="h-5 w-5 text-amber-500"
                      aria-hidden
                    />
                    Important Disclaimer
                  </div>
                  <DialogDescription className="flex items-center gap-2 text-sm text-muted-foreground">
                    Please read before building your analytics
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 text-sm leading-relaxed text-foreground">
                  {disclaimerSections.map((section) => (
                    <section key={section.title} className="space-y-1.5">
                      <h3
                        className={`text-base font-semibold ${section.accent}`}
                      >
                        {section.title}
                      </h3>
                      <p>{section.body}</p>
                    </section>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm font-semibold italic text-muted-foreground">
                  <ShieldQuestion className="h-4 w-4" aria-hidden />
                  Remember: TradeBlocks builds insights, not investment advice.
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
      <p className="inline-flex items-center gap-1 text-[0.68rem] italic text-muted-foreground">
        <Sparkles
          className="h-3.5 w-3.5 text-muted-foreground/70"
          aria-hidden
        />
        TradeBlocks builds insights, not investment advice.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
        <Link
          href="https://ninjata.co/"
          target="_blank"
          className="inline-flex items-center gap-1 font-medium text-primary transition hover:text-primary/80"
        >
          Inspired by NinjaTaco
          <Image
            src="/ninjataco-tribute.png"
            alt="NinjaTaco"
            width={16}
            height={16}
            className="opacity-80"
          />
        </Link>
        <span className="text-muted-foreground/50">•</span>
        <Link
          href="https://github.com/davidromeo/tradeblocks"
          target="_blank"
          className="inline-flex items-center gap-1 transition hover:text-foreground"
        >
          <Github className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium">GitHub</span>
        </Link>
      </div>
    </div>
  );
}

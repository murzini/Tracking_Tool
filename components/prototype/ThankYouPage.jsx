"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Backpack } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { fade } from "../../lib/prototype/fade";

export function ThankYouPage({ onGoHome, inTour, onCompleteTour }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <motion.div {...fade} transition={{ duration: 0.25 }}>
        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[#3C5A7D] text-white shadow-sm">
              <Backpack className="h-7 w-7" />
            </div>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight">Thank you</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Thanks for your trust in AdventureBag. We're preparing your order and will follow up with the next steps shortly.
            </p>
            {inTour ? (
              <Button className="mt-8 rounded-2xl px-6" onClick={onCompleteTour}>
                Return to Welcome
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button className="mt-8 rounded-2xl px-6" onClick={onGoHome}>
                Back to Home
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

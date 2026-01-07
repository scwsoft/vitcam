"use client";
import React, { useState } from "react";
import ComponentCard from "../../common/ComponentCard";
import Radio from "../input/Radio";

export default function RadioButtons() {
  const [selectedValue, setSelectedValue] = useState<string>("None");

  const handleRadioChange = (value: string) => {
    setSelectedValue(value);
   console.log("Selected value:", value);

  };
  return (
    <ComponentCard title="Recording Options">
      <div className="flex flex-wrap items-center gap-8">
        <Radio
          id="radio1"
          name="recopt"
          value="None"
          checked={selectedValue === "None"}
          onChange={handleRadioChange}
          label="None"
        />
        <Radio
          id="radio2"
          name="recopt"
          value="Continous"
          checked={selectedValue === "Continous"}
          onChange={handleRadioChange}
          label="Continous"
        />
        <Radio
          id="radio3"
          name="recopt"
          value="Motion Detected"
          checked={selectedValue === "Motion Detected"}
          onChange={handleRadioChange}
          label="Motion Detected"
        />
      </div>
    </ComponentCard>
  );
}

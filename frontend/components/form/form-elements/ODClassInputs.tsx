"use client";
import React, { useState , useRef} from "react";
import ComponentCard from "../../common/ComponentCard";
import Label from "../Label";
import Select from "../Select";
import MultiSelect from "../MultiSelect";
import { ChevronDownIcon } from "@/icons";
import Checkbox from "../input/Checkbox";
import Input from '../input/InputField';
export default function SelectInputs() {

  const [isObjectDetection, setIsObjectDetection] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [threadshold, setThredshold] = useState<string>("50");
  const [errorName, setErrorName] = useState(false);
  const inputObjClasseRef = useRef<HTMLInputElement>(null);

 const validateThredShold = (value: string) => {
   const isValidNumber =
     /^(100|[1-9][0-9]?)$/.test(value);
    setErrorName(!isValidNumber);
    return isValidNumber;
  };

  const handleThresHoldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   const value =  e.target.value;
        setThredshold(value);
        validateThredShold(value);
  };
  

  const handleSelectChange = (values: string[]) => {
    console.log("Selected value:", values);
    (values) => setSelectedValues(values)

    if(inputObjClasseRef.current)
      inputObjClasseRef.current.value = values.join(", ")
  
  };


  const handleObjectDetectionChange = (value:boolean) => {
   const val =  value;
   setIsObjectDetection(val)
   return val
  };

  const multiOptions = [
    { value: "-1", text: "All", selected: false },
    { value: "0", text: "Person", selected: false },
    { value: "1", text: "Bicycle", selected: false },
    { value: "2", text: "Car", selected: false },
    { value: "3", text: "Motorcycle", selected: false },
    { value: "5", text: "Bus", selected: false },
    { value: "7", text: "Truck", selected: false },
    { value: "8", text: "Boat", selected: false },
    { value: "15", text: "Bird", selected: false },
    { value: "16", text: "Cat", selected: false },
    { value: "17", text: "Dog", selected: false },
    { value: "26", text: "Backpack", selected: false },
    { value: "30", text: "Handbag", selected: false },
  ];

  return (
    <ComponentCard title="Detection Settings">
      <div className="flex items-center gap-6">
          <Label>Threadshold</Label>
          <Input 
            type="text" 
            name="thredshold"
            defaultValue={threadshold}
            error={errorName}
            onChange={handleThresHoldChange}
            placeholder="Enter Threshold"
            hint={errorName ? "Threshold value should be between 1 - 100." : ""}/>
            <Label>Object Detection</Label>
            <Checkbox
            name="isDetection"
            checked={isObjectDetection}
            onChange={handleObjectDetectionChange}/>
      </div>
      
      
      <div className="space-y-6">
        <div className="relative">
          <MultiSelect
            disabled={!isObjectDetection}
            label="Classes"
            options={multiOptions}
            defaultSelected={["-1"]}
            onChange={handleSelectChange}
            
          />
          
          <input name="clsid" type="hidden"  ref={inputObjClasseRef}></input>

          <p className="sr-only">
            Selected Values: {selectedValues.join(", ")}
          </p>
        </div>
      </div>

     </ComponentCard>
  );
}

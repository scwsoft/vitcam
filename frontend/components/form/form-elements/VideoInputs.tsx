"use client";
import React, { useState } from "react";
import ComponentCard from "../../common/ComponentCard";
import Label from "../Label";
import Select from "../Select";
import MultiSelect from "../MultiSelect";
import { ChevronDownIcon } from "@/icons";

export default function VideoInputs() {

  const encoderOptions = [
    { value: "jpeg", label: "JPEG" },
    { value: "mpeg", label: "MJPEG" },
    { value: "h264", label: "H.264/H.265/H.265+" },
    { value: "hls", label: "HLS(.m3u8)" },
    { value: "mp4", label: "MPEG-4(.mp4/.ts)" },
    { value: "rtmp", label: "RTMP" },
  ];

  const fpsOptions = [
    { value: "5", label: "5" },
    { value: "10", label: "10"},
    { value: "15", label: "15"},
    { value: "25", label: "25" },
    { value: "30", label: "30" },
    { value: "60", label: "60" },
  ];


  const resolutionOptions = [
    { value: "640,360", label: "640 x 360 pixels" },
    { value: "640,480", label: "640 x 480 pixels" },
    { value: "854,480", label: "(FWVGA) 854 x 480 pixels" },
    { value: "960,540", label: "(qHD) 960 x 540 pixels" },
    { value: "1280,720", label: "HD 720p HD 1280 x 720 pixels" },
    { value: "1366,768", label: "(WXGA) 1366 x 768 pixels" },
    { value: "1600,900", label: "(HD+) 1600 x 900 pixels" },
    { value: "1920,1080", label: "(Full HD) 1080p HD 1920 x 1080 pixels"},
    { value: "1280,1024", label: "1MP 1280 x 1024 pixels" },
    { value: "1600,1200", label: "2MP 1600 x 1200 pixels" },
    { value: "2048,1536", label: "3MP 2048 x 1536 pixels" },
    { value: "2688,1520", label: "4MP 2688 x 1520 pixels" },
    { value: "3072,2048", label: "6MP 3072 x 2048 pixels" },
    { value: "2560,1440", label: "(QHD) 2560 x 1440" },
    { value: "3200,1800", label: "(QHD+) 2K 3200 x 1800" },
    { value: "3840,2160", label: "(4K UHD) 8MP/4K	3840 x 2160 pixels" }
  ];

  const [selectedEncoderValues, setSelectedEncoderValues] = useState<string[]>([]);

  const handleEncoderSelectChange = (value: string) => {
    console.log("Selected Encoder value:", value);
  };

  const [selectedResolutionValues, setSelectedResolutionValues] = useState<string[]>([]);

  const handleResolutionSelectChange = (value: string) => {
    console.log("Selected Encoder value:", value);
  };

  const [selectedFpsValues, setSelectedFpsValues] = useState<string[]>([]);

  const handleFpsSelectChange = (value: string) => {
    console.log("Selected FPS value:", value);
  };

  const multiOptions = [
    { value: "1", text: "Option 1", selected: false },
    { value: "2", text: "Option 2", selected: false },
    { value: "3", text: "Option 3", selected: false },
    { value: "4", text: "Option 4", selected: false },
    { value: "5", text: "Option 5", selected: false },
  ];

  return (
    <ComponentCard title="Video Settings">
      <div className="space-y-6">
        <div>
          <Label>Encoder</Label>
         <div className="relative">
           <Select
            options={encoderOptions}
            placeholder="Select Option"
            onChange={handleEncoderSelectChange}
            className="dark:bg-dark-900"
            name="encoder"
          />
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
              <ChevronDownIcon/>
            </span>
         </div>
        </div>
        <div>
          <Label>Resolution</Label>
         <div className="relative">
           <Select
            options={resolutionOptions}
            placeholder="Select Option"
            onChange={handleResolutionSelectChange}
            className="dark:bg-dark-900"
            name="resolution"
          />
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
              <ChevronDownIcon/>
            </span>
         </div>
        </div>

        <div>
          <Label>Frame Rate</Label>
         <div className="relative">
           <Select
            options={fpsOptions}
            placeholder="Select Option"
            onChange={handleFpsSelectChange}
            className="dark:bg-dark-900"
            name="fps"
          />
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
              <ChevronDownIcon/>
            </span>
         </div>
        </div>
        
      </div>
    </ComponentCard>
  );
}

"use client";
import React, { useState } from 'react';
import ComponentCard from '../../common/ComponentCard';
import Label from '../Label';
import Input from '../input/InputField';
import Select from '../Select';
import TextArea from "../input/TextArea";

import { ChevronDownIcon, EyeCloseIcon, EyeIcon, TimeIcon } from '../../../icons';
import DatePicker from '@/components/form/date-picker';

export default function BasicInputs() {
  const [showPassword, setShowPassword] = useState(false);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [url, setURL] = useState("");
  const [errorName, setErrorName] = useState(false);
  const [errorURL, setErrorURL] = useState(false);

  
  const options = [
    { value: "remote", label: "Remote Camera" },
    { value: "local", label: "Local Camera" },
  ];
  const handleSelectChange = (value: string) => {
    console.log("Selected value:", value);
  };

  const validateName = (value: string) => {
    const isValidName =
      /^.{8,}$/.test(value);
    setErrorName(!isValidName);
    return isValidName;
  };

  const validateURL = (value: string) =>
  {
    const isValidURL = /^(rtsp|rtmp|https|http):\/\/(([^:@]+)(:[^:@]*)?@)?([^:/?#]+)(:\d+)?(\/[^\s?#]*)?(\?[^\s#]*)?(#[^\s]*)?/i.test(value);
    setErrorURL(!isValidURL);
    return isValidURL;

  }
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setName(value);
      validateName(value);
    };

  const handleURLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setURL(value);
      validateURL(value);
    };

  return (
    <ComponentCard title="General Information">
      <div className="space-y-6">
        <div>
          <Label>Name</Label>
          <Input 
            type="text" 
            defaultValue={name}
            name='name'
            error={errorName}
            onChange={handleNameChange}
            placeholder="Enter Name"
            hint={errorName ? "Name is required field and minimum of 8 character long." : ""}/>
        </div>
        <div>
          <Label>Type</Label>
          <div className="relative">
            <Select
            name='cameratype'
            options={options}
            onChange={handleSelectChange}
            className="dark:bg-dark-900"/>
             <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
              <ChevronDownIcon/>
            </span>
          </div>
        </div>
        <div>
          <div>
          <Label>URL</Label>
          <Input 
           type="text" 
            defaultValue={url}
            error={errorURL}
            onChange={handleURLChange}
            placeholder="Enter URL"
            name="url"
            hint={errorURL ? "Please enter a valid camera URL." : ""} />
          </div>
        </div>
        <div>
          <div>
          <Label>Description</Label>
           <TextArea 
            className='resize-none'
            rows={19}
            value={description}
            onChange={(value) => setDescription(value)}
            name='desc'
           />
          </div>
        </div>
      </div>
    </ComponentCard>
  );
}
